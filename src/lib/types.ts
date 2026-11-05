import type { Role, TaskStatus } from '../domain/transitions';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
}

export interface PersonRef {
  id?: string;
  full_name: string;
}

export interface ObjectRow {
  id: string;
  name: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface ObjectWithTasks extends ObjectRow {
  tasks: { status: TaskStatus }[];
}

export interface TaskRow {
  id: string;
  object_id: string;
  title: string;
  description: string;
  assignee_id: string;
  status: TaskStatus;
  author_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskListItem {
  id: string;
  title: string;
  status: TaskStatus;
  updated_at: string;
  assignee: PersonRef | null;
  object?: { id: string; name: string } | null;
}

export interface TaskDetails extends TaskRow {
  object: { id: string; name: string; address: string } | null;
  assignee: PersonRef | null;
  author: PersonRef | null;
}

export interface HistoryRow {
  id: number;
  created_at: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  comment: string | null;
  actor: PersonRef | null;
}
