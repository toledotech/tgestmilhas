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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
