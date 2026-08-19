export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: Row<{
          id: string;
          user_id: string;
          quest_id: string | null;
          title: string;
          raw_input: string;
          activity_type: string | null;
          status: string;
          total_minutes: number | null;
          effective_minutes: number | null;
          rules_version: string;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Row<Database["public"]["Tables"]["activities"]["Row"]>> & { user_id: string; raw_input: string; title: string; rules_version: string };
        Update: Update<Row<Database["public"]["Tables"]["activities"]["Row"]>>;
        Relationships: [];
      };
      ai_assessments: {
        Row: Row<{
          id: string;
          user_id: string;
          activity_id: string;
          rules_version: string;
          prompt_version: string | null;
          model_name: string | null;
          assessment_json: Json;
          confidence: number | null;
          status: string;
          confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Row<Database["public"]["Tables"]["ai_assessments"]["Row"]>> & { user_id: string; activity_id: string; rules_version: string; assessment_json: Json };
        Update: Update<Row<Database["public"]["Tables"]["ai_assessments"]["Row"]>>;
        Relationships: [];
      };
      skills: {
        Row: Row<{
          id: string;
          user_id: string;
          name: string;
          aliases: string[];
          level: number;
          xp: number;
          mastery_level: number;
          mastery_confidence: number;
          last_used_at: string | null;
          normalized_name: string;
          status: string;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Row<Database["public"]["Tables"]["skills"]["Row"]>> & { user_id: string; name: string };
        Update: Update<Row<Database["public"]["Tables"]["skills"]["Row"]>>;
        Relationships: [];
      };
      xp_transactions: {
        Row: Row<{
          id: string;
          user_id: string;
          activity_id: string;
          assessment_id: string;
          skill_id: string | null;
          activity_type: string | null;
          repetition_count: number;
          repetition_penalty: number;
          xp_type: string;
          amount: number;
          base_amount: number;
          modifier_json: Json;
          reason: string | null;
          rules_version: string;
          created_at: string;
        }>;
        Insert: Insert<Row<Database["public"]["Tables"]["xp_transactions"]["Row"]>> & { user_id: string; activity_id: string; assessment_id: string; amount: number; base_amount: number; rules_version: string };
        Update: Update<Row<Database["public"]["Tables"]["xp_transactions"]["Row"]>>;
        Relationships: [];
      };
      player_states: {
        Row: { user_id: string; player_level: number; total_xp: number; energy: number; focus: number; momentum: number; updated_at: string };
        Insert: Insert<Row<Database["public"]["Tables"]["player_states"]["Row"]>> & { user_id: string };
        Update: Update<Row<Database["public"]["Tables"]["player_states"]["Row"]>>;
        Relationships: [];
      };
      mastery_verifications: {
        Row: { id: string; user_id: string; skill_id: string; skill_name: string; from_level: number; to_level: number; evidence_level: number; status: string; proposal_assessment_id: string | null; created_at: string; resolved_at: string | null };
        Insert: Insert<Row<Database["public"]["Tables"]["mastery_verifications"]["Row"]>> & { user_id: string; skill_id: string; skill_name: string; from_level: number; to_level: number; evidence_level: number };
        Update: Update<Row<Database["public"]["Tables"]["mastery_verifications"]["Row"]>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
