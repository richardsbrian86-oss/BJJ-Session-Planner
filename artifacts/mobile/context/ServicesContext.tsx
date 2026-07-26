import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { api, ApiService } from "@/utils/apiClient";
import { loadToken } from "@/utils/apiClient";
import { useAuth } from "@/context/AuthContext";

export interface Service {
  id: string;
  backendId?: number;
  name: string;
  price: number;
}

interface ServicesContextType {
  services: Service[];
  addService: (s: Omit<Service, "id">) => Promise<void>;
  updateService: (s: Service) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  syncWithBackend: () => Promise<void>;
}

const SERVICES_KEY = "@bjj_services";

const DEFAULT_SERVICES: Service[] = [
  { id: "default-1", name: "30-min Private Session", price: 50 },
  { id: "default-2", name: "60-min Private Session", price: 80 },
  { id: "default-3", name: "90-min Private Session", price: 110 },
];

const ServicesContext = createContext<ServicesContextType | null>(null);

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

function apiServiceToLocal(s: ApiService): Service {
  return {
    id: `b-${s.id}`,
    backendId: s.id,
    name: s.name,
    price: s.price,
  };
}

export function ServicesProvider({ children }: { children: ReactNode }) {
  const { instructorId } = useAuth();
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const servicesRef = useRef<Service[]>(DEFAULT_SERVICES);
  const prevInstructorIdRef = useRef<number | null>(null);

  const persist = useCallback((next: Service[]) => {
    servicesRef.current = next;
    setServices(next);
    AsyncStorage.setItem(SERVICES_KEY, JSON.stringify(next));
  }, []);

  const syncWithBackend = useCallback(async () => {
    const token = await loadToken();
    if (!token) return;

    try {
      const apiServices = await api.services.list();

      if (apiServices.length > 0) {
        persist(apiServices.map(apiServiceToLocal));
      } else {
        const localUnsynced = servicesRef.current.filter((s) => !s.backendId);
        if (localUnsynced.length === 0) return;

        let updated = [...servicesRef.current];
        for (const svc of localUnsynced) {
          try {
            const created = await api.services.create(svc.name, svc.price);
            updated = updated.map((s) =>
              s.id === svc.id
                ? { ...s, id: `b-${created.id}`, backendId: created.id }
                : s
            );
          } catch {}
        }
        persist(updated);
      }
    } catch {}
  }, [persist]);

  useEffect(() => {
    AsyncStorage.getItem(SERVICES_KEY).then((raw) => {
      if (raw) {
        const parsed = JSON.parse(raw) as Service[];
        servicesRef.current = parsed;
        setServices(parsed);
      }
    });
    syncWithBackend();
  }, []);

  useEffect(() => {
    if (instructorId !== null && prevInstructorIdRef.current === null) {
      syncWithBackend();
    }
    prevInstructorIdRef.current = instructorId;
  }, [instructorId, syncWithBackend]);

  const addService = useCallback(
    async (s: Omit<Service, "id">) => {
      const localId = generateId();
      const newService: Service = { ...s, id: localId };
      const next = [...servicesRef.current, newService];
      persist(next);

      const token = await loadToken();
      if (token) {
        try {
          const created = await api.services.create(s.name, s.price);
          const withId = servicesRef.current.map((svc) =>
            svc.id === localId
              ? { ...svc, id: `b-${created.id}`, backendId: created.id }
              : svc
          );
          persist(withId);
        } catch {}
      }
    },
    [persist]
  );

  const updateService = useCallback(
    async (s: Service) => {
      persist(servicesRef.current.map((x) => (x.id === s.id ? s : x)));

      if (s.backendId) {
        try {
          await api.services.update(s.backendId, { name: s.name, price: s.price });
        } catch {}
      }
    },
    [persist]
  );

  const deleteService = useCallback(
    async (id: string) => {
      const svc = servicesRef.current.find((s) => s.id === id);
      persist(servicesRef.current.filter((x) => x.id !== id));

      if (svc?.backendId) {
        try {
          await api.services.delete(svc.backendId);
        } catch {}
      }
    },
    [persist]
  );

  return (
    <ServicesContext.Provider value={{ services, addService, updateService, deleteService, syncWithBackend }}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices(): ServicesContextType {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error("useServices must be used within ServicesProvider");
  return ctx;
}
