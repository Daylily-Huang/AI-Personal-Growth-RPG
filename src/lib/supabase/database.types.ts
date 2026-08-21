export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string | null
          completion: number | null
          created_at: string
          effective_minutes: number | null
          ended_at: string | null
          id: string
          quest_id: string | null
          quest_size_snapshot: string | null
          raw_input: string
          rules_version: string
          started_at: string | null
          status: string
          title: string
          total_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          completion?: number | null
          created_at?: string
          effective_minutes?: number | null
          ended_at?: string | null
          id?: string
          quest_id?: string | null
          quest_size_snapshot?: string | null
          raw_input: string
          rules_version: string
          started_at?: string | null
          status?: string
          title: string
          total_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string | null
          completion?: number | null
          created_at?: string
          effective_minutes?: number | null
          ended_at?: string | null
          id?: string
          quest_id?: string | null
          quest_size_snapshot?: string | null
          raw_input?: string
          rules_version?: string
          started_at?: string | null
          status?: string
          title?: string
          total_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assessments: {
        Row: {
          activity_id: string
          assessment_json: Json
          confidence: number | null
          confirmed_at: string | null
          created_at: string
          id: string
          model_name: string | null
          prompt_version: string | null
          rules_version: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          assessment_json: Json
          confidence?: number | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          model_name?: string | null
          prompt_version?: string | null
          rules_version: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          assessment_json?: Json
          confidence?: number | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          model_name?: string | null
          prompt_version?: string | null
          rules_version?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assessments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      artifact_links: {
        Row: {
          artifact_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          relation_type: string | null
          user_id: string
        }
        Insert: {
          artifact_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          relation_type?: string | null
          user_id: string
        }
        Update: {
          artifact_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          relation_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifact_links_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          artifact_type: string | null
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          reusability_score: number
          storage_path: string | null
          title: string
          updated_at: string
          user_id: string
          version: string | null
        }
        Insert: {
          artifact_type?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          reusability_score?: number
          storage_path?: string | null
          title: string
          updated_at?: string
          user_id: string
          version?: string | null
        }
        Update: {
          artifact_type?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          reusability_score?: number
          storage_path?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_records: {
        Row: {
          activity_id: string | null
          created_at: string
          description: string | null
          evidence_level: number
          evidence_type: string | null
          id: string
          knowledge_node_id: string | null
          skill_id: string | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          description?: string | null
          evidence_level?: number
          evidence_type?: string | null
          id?: string
          knowledge_node_id?: string | null
          skill_id?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          description?: string | null
          evidence_level?: number
          evidence_type?: string | null
          id?: string
          knowledge_node_id?: string | null
          skill_id?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "evidence_records_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_records_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_edges: {
        Row: {
          ai_inferred: boolean
          confidence: number
          created_at: string
          id: string
          relation_type: string
          source_node_id: string
          source_reference: string | null
          source_type: string | null
          target_node_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_inferred?: boolean
          confidence?: number
          created_at?: string
          id?: string
          relation_type: string
          source_node_id: string
          source_reference?: string | null
          source_type?: string | null
          target_node_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_inferred?: boolean
          confidence?: number
          created_at?: string
          id?: string
          relation_type?: string
          source_node_id?: string
          source_reference?: string | null
          source_type?: string | null
          target_node_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_nodes: {
        Row: {
          confidence: number
          created_at: string
          description: string | null
          domain_id: string | null
          id: string
          last_reviewed_at: string | null
          last_used_at: string | null
          mastery_level: number
          skill_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          description?: string | null
          domain_id?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_used_at?: string | null
          mastery_level?: number
          skill_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          description?: string | null
          domain_id?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_used_at?: string | null
          mastery_level?: number
          skill_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_nodes_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_nodes_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery_events: {
        Row: {
          activity_id: string | null
          confidence: number | null
          created_at: string
          event_type: string
          evidence_id: string | null
          from_level: number
          id: string
          knowledge_node_id: string | null
          reason: string | null
          skill_id: string | null
          to_level: number
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          confidence?: number | null
          created_at?: string
          event_type?: string
          evidence_id?: string | null
          from_level: number
          id?: string
          knowledge_node_id?: string | null
          reason?: string | null
          skill_id?: string | null
          to_level: number
          user_id: string
        }
        Update: {
          activity_id?: string | null
          confidence?: number | null
          created_at?: string
          event_type?: string
          evidence_id?: string | null
          from_level?: number
          id?: string
          knowledge_node_id?: string | null
          reason?: string | null
          skill_id?: string | null
          to_level?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_events_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_events_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery_verifications: {
        Row: {
          created_at: string
          evidence_level: number
          from_level: number
          id: string
          proposal_assessment_id: string | null
          resolved_at: string | null
          skill_id: string
          skill_name: string
          status: string
          to_level: number
          user_id: string
        }
        Insert: {
          created_at?: string
          evidence_level: number
          from_level: number
          id?: string
          proposal_assessment_id?: string | null
          resolved_at?: string | null
          skill_id: string
          skill_name: string
          status?: string
          to_level: number
          user_id: string
        }
        Update: {
          created_at?: string
          evidence_level?: number
          from_level?: number
          id?: string
          proposal_assessment_id?: string | null
          resolved_at?: string | null
          skill_id?: string
          skill_name?: string
          status?: string
          to_level?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_verifications_proposal_assessment_id_fkey"
            columns: ["proposal_assessment_id"]
            isOneToOne: false
            referencedRelation: "ai_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_verifications_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      player_states: {
        Row: {
          energy: number
          focus: number
          momentum: number
          player_level: number
          stress: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          energy?: number
          focus?: number
          momentum?: number
          player_level?: number
          stress?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          energy?: number
          focus?: number
          momentum?: number
          player_level?: number
          stress?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          onboarding_completed: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          onboarding_completed?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          onboarding_completed?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quests: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          difficulty: number
          goal_alignment: number
          id: string
          is_boss: boolean
          is_main_quest: boolean
          parent_quest_id: string | null
          progress: number
          quest_size: string | null
          quest_type: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          difficulty?: number
          goal_alignment?: number
          id?: string
          is_boss?: boolean
          is_main_quest?: boolean
          parent_quest_id?: string | null
          progress?: number
          quest_size?: string | null
          quest_type: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          difficulty?: number
          goal_alignment?: number
          id?: string
          is_boss?: boolean
          is_main_quest?: boolean
          parent_quest_id?: string | null
          progress?: number
          quest_size?: string | null
          quest_type?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quests_parent_same_user_fkey"
            columns: ["user_id", "parent_quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          id: string
          narrative: string | null
          period_end: string | null
          period_start: string | null
          review_type: string
          summary_json: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          narrative?: string | null
          period_end?: string | null
          period_start?: string | null
          review_type: string
          summary_json?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          narrative?: string | null
          period_end?: string | null
          period_start?: string | null
          review_type?: string
          summary_json?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rules_versions: {
        Row: {
          activated_at: string | null
          config_json: Json
          description: string | null
          id: string
          status: string
          version: string
        }
        Insert: {
          activated_at?: string | null
          config_json?: Json
          description?: string | null
          id?: string
          status?: string
          version: string
        }
        Update: {
          activated_at?: string | null
          config_json?: Json
          description?: string | null
          id?: string
          status?: string
          version?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          aliases: string[]
          created_at: string
          description: string | null
          domain_id: string | null
          id: string
          last_used_at: string | null
          level: number
          mastery_confidence: number
          mastery_level: number
          name: string
          normalized_name: string
          status: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          description?: string | null
          domain_id?: string | null
          id?: string
          last_used_at?: string | null
          level?: number
          mastery_confidence?: number
          mastery_level?: number
          name: string
          normalized_name: string
          status?: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          aliases?: string[]
          created_at?: string
          description?: string | null
          domain_id?: string | null
          id?: string
          last_used_at?: string | null
          level?: number
          mastery_confidence?: number
          mastery_level?: number
          name?: string
          normalized_name?: string
          status?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "skills_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_transactions: {
        Row: {
          activity_id: string
          activity_type: string | null
          amount: number
          assessment_id: string
          base_amount: number
          created_at: string
          domain_id: string | null
          id: string
          modifier_json: Json
          quest_id: string | null
          reason: string | null
          repetition_count: number
          repetition_penalty: number
          rules_version: string
          skill_id: string | null
          skill_name_snapshot: string
          user_id: string
          xp_type: string
        }
        Insert: {
          activity_id: string
          activity_type?: string | null
          amount: number
          assessment_id: string
          base_amount: number
          created_at?: string
          domain_id?: string | null
          id?: string
          modifier_json?: Json
          quest_id?: string | null
          reason?: string | null
          repetition_count?: number
          repetition_penalty?: number
          rules_version: string
          skill_id?: string | null
          skill_name_snapshot?: string
          user_id: string
          xp_type?: string
        }
        Update: {
          activity_id?: string
          activity_type?: string | null
          amount?: number
          assessment_id?: string
          base_amount?: number
          created_at?: string
          domain_id?: string | null
          id?: string
          modifier_json?: Json
          quest_id?: string | null
          reason?: string | null
          repetition_count?: number
          repetition_penalty?: number
          rules_version?: string
          skill_id?: string | null
          skill_name_snapshot?: string
          user_id?: string
          xp_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_xp_transactions_activity"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_xp_transactions_assessment"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "ai_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_xp_transactions_skill"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_activity: {
        Args: {
          p_activity_type?: string
          p_completion?: number
          p_effective_minutes?: number
          p_ended_at?: string
          p_quest_id?: string
          p_raw_input: string
          p_started_at?: string
          p_title: string
          p_total_minutes?: number
        }
        Returns: {
          activity_type: string | null
          completion: number | null
          created_at: string
          effective_minutes: number | null
          ended_at: string | null
          id: string
          quest_id: string | null
          quest_size_snapshot: string | null
          raw_input: string
          rules_version: string
          started_at: string | null
          status: string
          title: string
          total_minutes: number | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "activities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      player_level_from_xp: { Args: { p_total_xp: number }; Returns: number }
      recompute_quest_chain: {
        Args: { p_parent_id: string; p_user_id: string }
        Returns: undefined
      }
      record_ai_assessment: {
        Args: {
          p_activity_id: string
          p_assessment_json: Json
          p_confidence: number
          p_model_name: string
          p_prompt_version: string
          p_user_id: string
        }
        Returns: {
          activity_id: string
          assessment_json: Json
          confidence: number | null
          confirmed_at: string | null
          created_at: string
          id: string
          model_name: string | null
          prompt_version: string | null
          rules_version: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_assessments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      settle_activity: {
        Args: { p_settlement: Json; p_user_id: string }
        Returns: Json
      }
      xp_threshold_for_level: { Args: { p_level: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

