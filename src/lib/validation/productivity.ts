import { z } from "zod";
import { PRIORITIES, RECURRENCES, GOAL_STATUSES, day, name, optDateTime, optDay, optId, optMinutes, optText, optUrl, percent, tags, url } from "./common";

export const TASK_CATEGORIES = ["PERSONAL", "WORK", "HEALTH", "FINANCE", "LEARNING", "ERRAND", "OTHER"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

export const taskSchema = z
  .object({
    title: name("Title", 200),
    description: optText(4000),
    startDate: optDateTime,
    dueDate: optDateTime,
    allDay: z.boolean().default(true),
    priority: z.enum(PRIORITIES),
    category: z.enum(TASK_CATEGORIES),
    status: z.enum(TASK_STATUSES),
    reminderMinutes: optMinutes,
    recurrence: z.enum(RECURRENCES),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, { path: ["dueDate"], message: "Due date must be after the start" })
  .refine((v) => v.recurrence === "NONE" || !!v.dueDate, { path: ["dueDate"], message: "Recurring tasks need a due date" });

export const EVENT_TYPES = ["APPOINTMENT", "MEETING", "EVENT", "DEADLINE", "REMINDER", "OTHER"] as const;

export const eventSchema = z
  .object({
    title: name("Title", 200),
    description: optText(4000),
    location: optText(200),
    type: z.enum(EVENT_TYPES),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/, "Pick a start date"),
    end: optDateTime,
    allDay: z.boolean().default(false),
    reminderMinutes: optMinutes,
    recurrence: z.enum(RECURRENCES),
  })
  .refine((v) => !v.end || v.end >= v.start, { path: ["end"], message: "End must be after the start" });

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export const devProjectSchema = z
  .object({
    name: name("Project name", 100),
    description: optText(4000),
    status: z.enum(PROJECT_STATUSES),
    startDate: optDay,
    deadline: optDay,
    techStack: tags,
    repoUrl: optUrl,
    liveUrl: optUrl,
    notes: optText(8000),
  })
  .refine((v) => !v.startDate || !v.deadline || v.deadline >= v.startDate, { path: ["deadline"], message: "Deadline must be after the start" });

export const DEV_TASK_TYPES = ["IDEA", "FEATURE", "BUG", "IMPROVEMENT", "TECH_DEBT", "RESEARCH"] as const;
export const DEV_TASK_STATUSES = ["IDEAS", "BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "COMPLETED"] as const;
export const devTaskSchema = z.object({
  title: name("Title", 200),
  description: optText(4000),
  type: z.enum(DEV_TASK_TYPES),
  status: z.enum(DEV_TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  projectId: optId,
  dueDate: optDay,
});

export const BOOKMARK_CATEGORIES = ["DOCUMENTATION", "REPOSITORY", "TUTORIAL", "ARTICLE", "API", "TOOL", "SNIPPET", "IDEA", "OTHER"] as const;
export const bookmarkSchema = z.object({
  title: name("Title", 200),
  url,
  description: optText(2000),
  category: z.enum(BOOKMARK_CATEGORIES),
  tags,
  isFavourite: z.boolean().default(false),
});

export const LEARNING_KINDS = ["LANGUAGE", "FRAMEWORK", "TECHNOLOGY", "COURSE", "TUTORIAL", "SKILL"] as const;
export const LEARNING_STATUSES = ["WANT_TO_LEARN", "LEARNING", "PAUSED", "COMPLETED"] as const;
export const learningSchema = z.object({
  name: name("Name", 120),
  kind: z.enum(LEARNING_KINDS),
  status: z.enum(LEARNING_STATUSES),
  progress: percent,
  resourceUrl: optUrl,
  targetDate: optDay,
  notes: optText(4000),
});

export const snippetSchema = z.object({
  title: name("Title", 200),
  language: name("Language", 40),
  code: z.string().min(1, "Code is required").max(50_000, "Snippet is too large"),
  description: optText(2000),
  tags,
});

export const DEV_GOAL_TYPES = ["BUILD_SAAS", "LEARN_FRAMEWORK", "COMPLETE_COURSE", "OPEN_SOURCE", "DEPLOY_PROJECT", "OTHER"] as const;
export const devGoalSchema = z.object({
  title: name("Title", 200),
  description: optText(4000),
  type: z.enum(DEV_GOAL_TYPES),
  status: z.enum(GOAL_STATUSES),
  progress: percent,
  targetDate: optDay,
});

export const noteSchema = z.object({
  title: name("Title", 200),
  content: z.string().max(100_000, "Note is too long").default(""),
  category: optText(60),
  isPinned: z.boolean().default(false),
});

export const DOCUMENT_CATEGORIES = ["RECEIPT", "INVOICE", "CONTRACT", "ID", "TAX", "INSURANCE", "MEDICAL", "EDUCATION", "OTHER"] as const;
export const documentMetaSchema = z.object({
  name: name("Name", 200),
  category: z.enum(DOCUMENT_CATEGORIES),
  description: optText(1000),
});

export const preferenceSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  timezone: z.string().min(1).max(60),
  locale: z.string().min(2).max(20),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
  budgetAlertThreshold: z.coerce.number().int().min(10).max(100),
  billReminderDays: z.coerce.number().int().min(0).max(60),
  loanReminderDays: z.coerce.number().int().min(0).max(60),
  taskReminderDays: z.coerce.number().int().min(0).max(60),
  projectReminderDays: z.coerce.number().int().min(0).max(90),
});

export const profileSchema = z.object({ name: name("Name", 80) });

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(10, "Use at least 10 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const registerSchema = z
  .object({
    name: name("Name", 80),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export { day, optId };
