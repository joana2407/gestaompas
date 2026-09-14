export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          created_at: string
          id: string
          source_filename: string | null
          status: string
          summary: string | null
          total_alerts: number
          total_at_risk: number
          updated_at: string
          week_label: string
          week_start: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          source_filename?: string | null
          status?: string
          summary?: string | null
          total_alerts?: number
          total_at_risk?: number
          updated_at?: string
          week_label: string
          week_start?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          source_filename?: string | null
          status?: string
          summary?: string | null
          total_alerts?: number
          total_at_risk?: number
          updated_at?: string
          week_label?: string
          week_start?: string | null
        }
        Relationships: []
      }
      rasff_alerts: {
        Row: {
          analysis_id: string
          created_at: string
          hazard: string | null
          hazard_type: string | null
          id: string
          manufacturer: string | null
          notified_on: string | null
          origin_country: string | null
          product: string
          raw_text: string | null
          reference: string | null
        }
        Insert: {
          analysis_id: string
          created_at?: string
          hazard?: string | null
          hazard_type?: string | null
          id?: string
          manufacturer?: string | null
          notified_on?: string | null
          origin_country?: string | null
          product: string
          raw_text?: string | null
          reference?: string | null
        }
        Update: {
          analysis_id?: string
          created_at?: string
          hazard?: string | null
          hazard_type?: string | null
          id?: string
          manufacturer?: string | null
          notified_on?: string | null
          origin_country?: string | null
          product?: string
          raw_text?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rasff_alerts_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_ingredients: {
        Row: {
          created_at: string
          id: string
          name: string
          origin: string | null
          raw_material_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          origin?: string | null
          raw_material_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          origin?: string | null
          raw_material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_ingredients_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          category: string | null
          code: string | null
          created_at: string
          id: string
          kind: string
          name: string
          notes: string | null
          origins: string[]
          supplier: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string
          id?: string
          kind?: string
          name: string
          notes?: string | null
          origins?: string[]
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          origins?: string[]
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      risk_findings: {
        Row: {
          alert_id: string | null
          analysis_id: string
          created_at: string
          id: string
          ingredient_name: string | null
          raw_material_id: string | null
          raw_material_kind: string | null
          raw_material_name: string
          reason: string | null
          recommendation: string | null
          review_note: string | null
          reviewed: boolean
          risk_level: string
          risk_type: string | null
          traceability: string | null
          updated_at: string
        }
        Insert: {
          alert_id?: string | null
          analysis_id: string
          created_at?: string
          id?: string
          ingredient_name?: string | null
          raw_material_id?: string | null
          raw_material_kind?: string | null
          raw_material_name: string
          reason?: string | null
          recommendation?: string | null
          review_note?: string | null
          reviewed?: boolean
          risk_level: string
          risk_type?: string | null
          traceability?: string | null
          updated_at?: string
        }
        Update: {
          alert_id?: string | null
          analysis_id?: string
          created_at?: string
          id?: string
          ingredient_name?: string | null
          raw_material_id?: string | null
          raw_material_kind?: string | null
          raw_material_name?: string
          reason?: string | null
          recommendation?: string | null
          review_note?: string | null
          reviewed?: boolean
          risk_level?: string
          risk_type?: string | null
          traceability?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_findings_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "rasff_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_findings_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_findings_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
