"use client";
import { EntityForm } from "@/components/shared/entity-form";
import { usePrefs } from "@/components/providers";
import { todayStr } from "@/lib/today";
import { bookmarkSchema, devGoalSchema, devProjectSchema, devTaskSchema, eventSchema, learningSchema, snippetSchema, taskSchema } from "@/lib/validation/productivity";
import { saveEvent, saveTask } from "@/server/actions/planner";
import { saveBookmark, saveDevGoal, saveDevTask, saveLearning, saveProject, saveSnippet } from "@/server/actions/dev";
import {
  BOOKMARK_CAT_OPTS,
  DEV_GOAL_TYPE_OPTS,
  DEV_TASK_STATUS_OPTS,
  DEV_TASK_TYPE_OPTS,
  EVENT_TYPE_OPTS,
  GOAL_STATUS_OPTS,
  LEARNING_KIND_OPTS,
  LEARNING_STATUS_OPTS,
  PRIORITY_OPTS,
  PROJECT_STATUS_OPTS,
  RECURRENCE_OPTS,
  TASK_CATEGORY_OPTS,
  TASK_STATUS_OPTS,
} from "./options";
import type { Option } from "@/components/shared/entity-form";

type Base = { open: boolean; onOpenChange: (o: boolean) => void; onSuccess?: () => void };
type Init = Record<string, unknown> & { id?: string };

const REMINDER_OPTS: Option[] = [
  { value: "0", label: "At due time" },
  { value: "15", label: "15 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
  { value: "4320", label: "3 days before" },
  { value: "10080", label: "1 week before" },
];

export function TaskDialog({ initial, ...p }: Base & { initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      wide
      title={id ? "Edit task" : "Add task"}
      schema={taskSchema}
      fields={[
        { name: "title", label: "Title", type: "text", span: 2, placeholder: "What needs doing?" },
        { name: "allDay", label: "All-day", type: "switch", description: "Turn off to set specific times." },
        { name: "startDate", label: "Start", type: "date", hidden: (v) => !v.allDay },
        { name: "dueDate", label: "Due", type: "date", hidden: (v) => !v.allDay },
        { name: "startDate", label: "Start", type: "datetime", hidden: (v) => !!v.allDay },
        { name: "dueDate", label: "Due", type: "datetime", hidden: (v) => !!v.allDay },
        { name: "priority", label: "Priority", type: "select", options: PRIORITY_OPTS },
        { name: "category", label: "Category", type: "select", options: TASK_CATEGORY_OPTS },
        { name: "status", label: "Status", type: "select", options: TASK_STATUS_OPTS },
        { name: "recurrence", label: "Repeats", type: "select", options: RECURRENCE_OPTS },
        { name: "reminderMinutes", label: "In-app reminder", type: "select", allowNone: `Default (${"1 day"} before)`, options: REMINDER_OPTS, span: 2 },
        { name: "description", label: "Description", type: "textarea", rows: 3 },
      ]}
      defaultValues={{ title: "", allDay: true, startDate: "", dueDate: todayStr(prefs.timezone), priority: "MEDIUM", category: "PERSONAL", status: "TODO", recurrence: "NONE", reminderMinutes: "", description: "", ...initial }}
      onSubmit={(v) => saveTask(id, v)}
    />
  );
}

export function EventDialog({ initial, ...p }: Base & { initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id ?? null;
  const d = todayStr(prefs.timezone);
  return (
    <EntityForm
      {...p}
      wide
      title={id ? "Edit event" : "Add event"}
      schema={eventSchema}
      fields={[
        { name: "title", label: "Title", type: "text", span: 2, placeholder: "e.g. Dentist, Team standup" },
        { name: "type", label: "Type", type: "select", options: EVENT_TYPE_OPTS },
        { name: "location", label: "Location", type: "text" },
        { name: "allDay", label: "All-day", type: "switch" },
        { name: "start", label: "Starts", type: "date", hidden: (v) => !v.allDay },
        { name: "end", label: "Ends", type: "date", hidden: (v) => !v.allDay },
        { name: "start", label: "Starts", type: "datetime", hidden: (v) => !!v.allDay },
        { name: "end", label: "Ends", type: "datetime", hidden: (v) => !!v.allDay },
        { name: "reminderMinutes", label: "In-app reminder", type: "select", allowNone: "1 day before (default)", options: REMINDER_OPTS },
        { name: "recurrence", label: "Repeats", type: "select", options: RECURRENCE_OPTS },
        { name: "description", label: "Notes", type: "textarea", rows: 3 },
      ]}
      defaultValues={{ title: "", type: "APPOINTMENT", location: "", allDay: false, start: `${d}T09:00`, end: `${d}T10:00`, reminderMinutes: "", recurrence: "NONE", description: "", ...initial }}
      onSubmit={(v) => saveEvent(id, v)}
    />
  );
}

export function ProjectDialog({ initial, ...p }: Base & { initial?: Init }) {
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      wide
      title={id ? "Edit project" : "New project"}
      schema={devProjectSchema}
      fields={[
        { name: "name", label: "Project name", type: "text" },
        { name: "status", label: "Status", type: "select", options: PROJECT_STATUS_OPTS },
        { name: "startDate", label: "Start date", type: "date" },
        { name: "deadline", label: "Deadline", type: "date" },
        { name: "techStack", label: "Tech stack", type: "tags", placeholder: "Next.js, Prisma, PostgreSQL", span: 2, description: "Comma-separated." },
        { name: "repoUrl", label: "GitHub repository", type: "url", placeholder: "https://github.com/…" },
        { name: "liveUrl", label: "Live URL", type: "url", placeholder: "https://" },
        { name: "description", label: "Description", type: "textarea", rows: 2 },
        { name: "notes", label: "Notes", type: "textarea", rows: 4 },
      ]}
      defaultValues={{ name: "", status: "PLANNING", startDate: "", deadline: "", techStack: "", repoUrl: "", liveUrl: "", description: "", notes: "", ...initial }}
      onSubmit={(v) => saveProject(id, v)}
    />
  );
}

export function DevTaskDialog({ initial, projects, ...p }: Base & { initial?: Init; projects: Option[] }) {
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit item" : "Add backlog item"}
      schema={devTaskSchema}
      fields={[
        { name: "title", label: "Title", type: "text", span: 2 },
        { name: "type", label: "Type", type: "select", options: DEV_TASK_TYPE_OPTS },
        { name: "status", label: "Column", type: "select", options: DEV_TASK_STATUS_OPTS },
        { name: "priority", label: "Priority", type: "select", options: PRIORITY_OPTS },
        { name: "projectId", label: "Project", type: "select", allowNone: "No project", options: projects },
        { name: "dueDate", label: "Due date", type: "date" },
        { name: "description", label: "Details", type: "textarea", rows: 3 },
      ]}
      defaultValues={{ title: "", type: "FEATURE", status: "BACKLOG", priority: "MEDIUM", projectId: "", dueDate: "", description: "", ...initial }}
      onSubmit={(v) => saveDevTask(id, v)}
    />
  );
}

export function BookmarkDialog({ initial, ...p }: Base & { initial?: Init }) {
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit bookmark" : "Save bookmark"}
      schema={bookmarkSchema}
      fields={[
        { name: "url", label: "URL", type: "url", span: 2, placeholder: "https://" },
        { name: "title", label: "Title", type: "text", span: 2 },
        { name: "category", label: "Category", type: "select", options: BOOKMARK_CAT_OPTS },
        { name: "tags", label: "Tags", type: "tags", placeholder: "react, auth" },
        { name: "description", label: "Description", type: "textarea", rows: 2 },
        { name: "isFavourite", label: "Favourite", type: "switch" },
      ]}
      defaultValues={{ url: "", title: "", category: "DOCUMENTATION", tags: "", description: "", isFavourite: false, ...initial }}
      onSubmit={(v) => saveBookmark(id, v)}
    />
  );
}

export function LearningDialog({ initial, ...p }: Base & { initial?: Init }) {
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit learning item" : "Add learning item"}
      schema={learningSchema}
      fields={[
        { name: "name", label: "What are you learning?", type: "text", span: 2, placeholder: "e.g. Rust, Kubernetes, CS50" },
        { name: "kind", label: "Kind", type: "select", options: LEARNING_KIND_OPTS },
        { name: "status", label: "Status", type: "select", options: LEARNING_STATUS_OPTS },
        { name: "progress", label: "Progress (%)", type: "number" },
        { name: "targetDate", label: "Target date", type: "date" },
        { name: "resourceUrl", label: "Course / resource URL", type: "url", span: 2 },
        { name: "notes", label: "Notes", type: "textarea", rows: 3 },
      ]}
      defaultValues={{ name: "", kind: "FRAMEWORK", status: "WANT_TO_LEARN", progress: 0, targetDate: "", resourceUrl: "", notes: "", ...initial }}
      onSubmit={(v) => saveLearning(id, v)}
    />
  );
}

export const SNIPPET_LANGS = ["typescript", "tsx", "javascript", "jsx", "python", "sql", "bash", "json", "css", "html", "go", "rust", "java", "php", "yaml", "markdown", "other"];

export function SnippetDialog({ initial, ...p }: Base & { initial?: Init }) {
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      wide
      title={id ? "Edit snippet" : "New snippet"}
      schema={snippetSchema}
      fields={[
        { name: "title", label: "Title", type: "text" },
        { name: "language", label: "Language", type: "select", options: SNIPPET_LANGS.map((l) => ({ value: l, label: l })) },
        { name: "code", label: "Code", type: "code", rows: 12 },
        { name: "description", label: "Description", type: "textarea", rows: 2 },
        { name: "tags", label: "Tags", type: "tags", span: 2, placeholder: "prisma, auth" },
      ]}
      defaultValues={{ title: "", language: "typescript", code: "", description: "", tags: "", ...initial }}
      onSubmit={(v) => saveSnippet(id, v)}
    />
  );
}

export function DevGoalDialog({ initial, ...p }: Base & { initial?: Init }) {
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit developer goal" : "New developer goal"}
      schema={devGoalSchema}
      fields={[
        { name: "title", label: "Goal", type: "text", span: 2, placeholder: "e.g. Ship my first SaaS" },
        { name: "type", label: "Type", type: "select", options: DEV_GOAL_TYPE_OPTS },
        { name: "status", label: "Status", type: "select", options: GOAL_STATUS_OPTS },
        { name: "progress", label: "Progress (%)", type: "number" },
        { name: "targetDate", label: "Target date", type: "date" },
        { name: "description", label: "Description", type: "textarea", rows: 3 },
      ]}
      defaultValues={{ title: "", type: "BUILD_SAAS", status: "ACTIVE", progress: 0, targetDate: "", description: "", ...initial }}
      onSubmit={(v) => saveDevGoal(id, v)}
    />
  );
}
