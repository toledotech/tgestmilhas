// Tipagem manual (mínima) das tabelas usadas pelo app — não é gerada pelo
// Supabase CLI (sem acesso a ele neste ambiente). Cobre só as colunas que
// o código usa; ajuste/expanda com `supabase gen types` quando possível.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
          id: number;
          email: string;
          phone: string | null;
          profile: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          email: string;
          phone?: string | null;
          profile: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: number;
          text: string | null;
          image_base64: string | null;
          image_mimetype: string | null;
          status: "draft" | "scheduled" | "sent" | "failed";
          scheduled_for: string | null;
          sent_at: string | null;
          error: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          text?: string | null;
          image_base64?: string | null;
          image_mimetype?: string | null;
          status: "draft" | "scheduled" | "sent" | "failed";
          scheduled_for?: string | null;
          sent_at?: string | null;
          error?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      admin_users: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_users"]["Insert"]>;
        Relationships: [];
      };
      miles_search_cache: {
        Row: {
          id: number;
          cache_key: string;
          origin: string;
          destination: string;
          date: string;
          program: string;
          results: Json;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          cache_key: string;
          origin: string;
          destination: string;
          date: string;
          program: string;
          results: Json;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["miles_search_cache"]["Insert"]>;
        Relationships: [];
      };
      explore_routes: {
        Row: {
          id: number;
          origin: string;
          destination: string;
          label: string;
          country: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          origin: string;
          destination: string;
          label: string;
          country: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["explore_routes"]["Insert"]>;
        Relationships: [];
      };
      explore_results: {
        Row: {
          id: number;
          route_id: number;
          origin: string;
          destination: string;
          label: string;
          country: string;
          cheapest_miles: number;
          cheapest_taxes: number;
          cheapest_program: string;
          offers: Json;
          sample_date: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          route_id: number;
          origin: string;
          destination: string;
          label: string;
          country: string;
          cheapest_miles: number;
          cheapest_taxes: number;
          cheapest_program: string;
          offers?: Json;
          sample_date: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["explore_results"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
