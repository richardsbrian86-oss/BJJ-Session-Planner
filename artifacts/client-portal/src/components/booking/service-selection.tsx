import { useState } from "react";
import { Service } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { Check, Clock } from "lucide-react";

interface ServiceSelectionValue {
  serviceId: number | null;
  packageCount: number;
  isSubscription: boolean;
}

interface ServiceSelectionProps {
  services: Service[];
  value: ServiceSelectionValue;
  onChange: (data: Partial<ServiceSelectionValue>) => void;
  onNext: () => void;
}

const PACKAGES = [
  { count: 1, label: "Single Session" },
  { count: 6, label: "6 Sessions" },
  { count: 8, label: "8 Sessions" },
  { count: 10, label: "10 Sessions" },
];

export function ServiceSelection({ services, value, onChange, onNext }: ServiceSelectionProps) {
  const selectedService = services.find(s => s.id === value.serviceId);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Select a Service</h2>
        <div className="grid gap-3">
          {services.map((service) => (
            <Card 
              key={service.id} 
              className={`cursor-pointer transition-all border ${value.serviceId === service.id ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border/50 hover:border-primary/50 bg-card'}`}
              onClick={() => onChange({ serviceId: service.id })}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{service.name}</h3>
                    {value.serviceId === service.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Private Session</span>
                  </div>
                </div>
                <div className="font-bold whitespace-nowrap">
                  {formatCurrency(service.price)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedService && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Select Package</h2>
            <div className="flex items-center space-x-2">
              <Switch 
                id="subscription" 
                checked={value.isSubscription}
                onCheckedChange={(checked) => onChange({ isSubscription: checked })}
              />
              <Label htmlFor="subscription" className="text-sm text-muted-foreground cursor-pointer">
                Subscribe monthly
              </Label>
            </div>
          </div>
          
          <div className="grid gap-3">
            {PACKAGES.map((pkg) => {
              const isDiscounted = pkg.count > 1;
              const subtotal = selectedService.price * pkg.count;
              const discount = isDiscounted ? subtotal * 0.2 : 0;
              const total = subtotal - discount;
              const perSession = total / pkg.count;
              const isSelected = value.packageCount === pkg.count;

              return (
                <Card 
                  key={pkg.count}
                  className={`cursor-pointer transition-all border ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border/50 hover:border-primary/50 bg-card'}`}
                  onClick={() => onChange({ packageCount: pkg.count })}
                >
                  <CardContent className="p-4 flex items-center justify-between relative overflow-hidden">
                    {isDiscounted && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                        SAVE 20%
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{pkg.label}</h3>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(perSession)} per session
                      </div>
                    </div>
                    <div className="text-right">
                      {isDiscounted && (
                        <div className="text-xs text-muted-foreground line-through mb-0.5">
                          {formatCurrency(subtotal)}
                        </div>
                      )}
                      <div className="font-bold text-lg">
                        {formatCurrency(total)}{value.isSubscription ? '/mo' : ''}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-4">
        <Button 
          size="lg" 
          className="w-full h-14 text-base rounded-xl"
          disabled={!value.serviceId}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
