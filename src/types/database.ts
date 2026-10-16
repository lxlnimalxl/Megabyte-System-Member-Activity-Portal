export type UserRole = 'employee' | 'manager' | 'ceo';
export type ProjectStatus = 'active' | 'paused' | 'completed';
export type BlockerSeverity = 'low' | 'medium' | 'critical';
export type ReviewStatus = 'pending' | 'approved' | 'needs_revision';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  created_by: string | null;
  created_at: string;
}

export interface WorkLog {
  id: string;
  user_id: string;
  project_id: string;
  work_date: string;
  duration_minutes: number;
  summary: string;
  sub_tasks: SubTask[];
  progress_percent: number;
  has_blocker: boolean;
  blocker_category: string | null;
  blocker_severity: BlockerSeverity;
  blocker_description: string | null;
  blocker_resolved: boolean;
  manager_status: ReviewStatus;
  manager_feedback: string | null;
  reviewed_by: string | null;
  created_at: string;
  // Joined relation fields
  profiles?: Profile;
  projects?: Project;
  reviewer?: Profile;
}

export interface AssignedTask {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  assigned_to: string;
  assigned_by: string;
  priority: BlockerSeverity;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  // Joined relation fields
  assignee?: Profile;
  creator?: Profile;
  projects?: Project;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
  author?: Profile;
}

// Database schema types for Supabase client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Profile>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Project>;
      };
      work_logs: {
        Row: WorkLog;
        Insert: Omit<WorkLog, 'id' | 'created_at' | 'profiles' | 'projects' | 'reviewer'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<WorkLog, 'profiles' | 'projects' | 'reviewer'>>;
      };
      assigned_tasks: {
        Row: AssignedTask;
        Insert: Omit<AssignedTask, 'id' | 'created_at' | 'assignee' | 'creator' | 'projects'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<AssignedTask, 'assignee' | 'creator' | 'projects'>>;
      };
      announcements: {
        Row: Announcement;
        Insert: Omit<Announcement, 'id' | 'created_at' | 'author'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Announcement, 'author'>>;
      };
    };
  };
}
