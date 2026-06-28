# 🥋 BJJ Session Planner

A scheduling tool built for Brazilian Jiu-Jitsu instructors and academies — born out of a real problem I lived through on the mats.

> **Built entirely on [Replit](https://replit.com)** — from the first line of code to deployment, using Replit's AI Agent and custom Skills I configured to handle repeatable tasks throughout the project.

---

## 🧠 The Problem I Was Solving

As a BJJ black belt and instructor, I watched the same chaos repeat itself every week:

- Instructors would forget to update their availability, leaving students to show up with no one to teach them
- Students would book the same time slot as someone else, causing confusion on the mat
- Confirmations happened over WhatsApp or text — easily missed, easily forgotten
- There was no single place to look and see *who is teaching, when, and how many students are coming*

I didn't want to build something for the sake of building it. I wanted to solve a problem I actually cared about. This project is the result.

---

## 🔧 How I Built This — The Replit Workflow

This entire project was built inside **Replit**, which shaped how I worked from day one.

Rather than switching between a local editor, a terminal, and a deployment tool, everything lived in one place. That freed me to focus on thinking through the problem instead of managing my environment.

### Replit AI Agent

I used Replit's AI Agent to help me move faster on tasks where I knew what I wanted but didn't want to lose momentum writing boilerplate. For example:

- Scaffolding the initial file structure for the instructor and student modules
- Generating the base conflict-detection logic in `src/session-planner.ts`, which I then reviewed, adjusted, and extended
- Drafting the test file structure so I could get to writing meaningful test cases faster

The key was treating the Agent as a thinking partner — I'd describe the outcome I wanted in plain terms, review what it produced, and push back or refine it until it matched my intent. I never accepted output I didn't understand.

### Custom Replit Skills

Beyond the Agent, I built and configured custom **Replit Skills** — reusable instructions that tell the Agent how to handle specific recurring tasks in *this* project. This saved significant time and kept things consistent.

Skills I built for this project included:

- **Scheduling Logic Skill** — instructions for how conflict detection should work, so the Agent understood the rules of the domain (BJJ sessions have instructors, time windows, and student caps) rather than treating it as a generic calendar problem
- **Testing Skill** — a pattern for how new logic should be tested, ensuring the Agent always scaffolded tests in the same structure rather than doing something different each time
- **Module Boundary Skill** — guidelines for where new code should live (instructor module vs student module vs shared utilities), keeping the project from becoming a mess as it grew

Building these Skills made me think clearly about *my own standards* — you can't write instructions for an agent unless you already know what good looks like.

---

## 💡 My Thinking Behind the Design

Before writing a single line of code, I asked myself: *what does an instructor actually need on a day-to-day basis?*

The answer wasn't complicated — they need to say "I'm available these times," and have the system take care of the rest. No double-bookings. No chasing students for confirmations. No admin overhead.

That thinking shaped every decision:

- **Instructors set availability once** — the system decides whether a slot is bookable, not the instructor manually checking
- **Conflict checks happen automatically** — instead of relying on people to remember what they've already booked, the app checks for overlaps before confirming anything
- **Students get instant confirmation** — removing the back-and-forth that usually happens over messages
- **The admin view shows the full picture** — who's teaching, when, and how full each class is

---

## 🏗️ How I Broke the Problem Down

Rather than trying to build everything at once, I identified four clear areas of responsibility:

| Area | What it handles |
|---|---|
| **Instructor Module** | Availability, session creation, class limits |
| **Student Module** | Booking sessions, receiving confirmations |
| **Calendar Sync Engine** | Detecting and preventing scheduling conflicts |
| **Admin Dashboard** | Full academy-wide view of the schedule |

Keeping these separate meant I could reason about each piece independently and test them without everything being tangled together.

---

## ✅ How I Approached Testing

I didn't want tests just for the sake of having them. The core logic I most wanted to protect was the conflict detection — if that breaks, double-bookings happen, and the whole point of the app falls apart.

So I started there. The test suite focuses on the scheduling logic: can the system correctly identify when a new session overlaps with an existing one, and refuse to book it?

Running the tests:

```bash
pnpm install
pnpm test
```

Example of the logic being tested:

```ts
import { canScheduleSession, scheduleSession, Session } from './src';

const existing: Session[] = [
  { instructor: 'Coach Lee', start: '09:00', end: '10:00', students: 4 },
];

const nextSession: Session = {
  instructor: 'Coach Lee',
  start: '10:15',
  end: '11:15',
  students: 5,
};

if (canScheduleSession(existing, nextSession)) {
  const updated = scheduleSession(existing, nextSession);
  console.log('Scheduled sessions:', updated);
} else {
  console.log('Session conflict detected');
}
```

---

## 🛠️ Tech Choices and Why

| Layer | Choice | Reason |
|---|---|---|
| Frontend | HTML, CSS, JavaScript | Kept it straightforward — the UI needs to be fast and clear, not flashy |
| Backend | Node.js | Fits well with JavaScript across the stack; easy to iterate quickly |
| Database | MongoDB / Replit DB | Flexible document model suits session and availability data |
| Calendar | External calendar APIs | Leverage what already exists rather than rebuilding it |
| CI/CD | GitHub Actions | Automated checks on every push via `.github/workflows/Bflow.yml` |
| Platform | Replit | End-to-end: development, AI assistance, custom Skills, and deployment |

---

## 🚀 What I'd Build Next

If I were to keep developing this, the next priorities would be:

1. **Recurring sessions** — most BJJ classes run on a weekly schedule, so instructors shouldn't have to re-enter availability every week
2. **Waitlists** — when a class fills up, students should be able to join a queue and get notified if a spot opens
3. **Instructor analytics** — a simple view of how many students each instructor is seeing over time

---

## 👤 About Me

**Brian Richards**
Brazilian Jiu-Jitsu Black Belt · Instructor · Full-Stack Developer

I build things that solve problems I've actually experienced. This project sits at the intersection of two parts of my life — time on the mats and time writing code.

GitHub: [richardsbrian86-oss](https://github.com/richardsbrian86-oss)
