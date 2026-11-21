
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "approvals": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approvals_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"backup_records": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "backup_records_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"bank_accounts": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_accounts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"bank_entries": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_entries_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"branches": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "branches_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "created_at": string,"details": NonNullable<Json>,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"campaigns": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaigns_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_adjustments": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_adjustments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_closings": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_closings_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"cheques": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cheques_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"commission_payments": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "commission_payments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"commissions": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "commissions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"complaints": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "complaints_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_notes": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_notes_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"damage_logs": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "damage_logs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"debit_notes": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "debit_notes_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_challans": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_challans_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"display_stock": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "display_stock_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"estimates": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "estimates_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_categories": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_ups": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_ups_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"loan_accounts": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loan_accounts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"lots": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lots_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"role": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"role": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"role"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"message_outbox": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_outbox_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"offers": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"parties": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parties_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"portal_links": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "portal_links_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"price_lists": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "price_lists_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"print_templates": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "print_templates_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"product_costs": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_costs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"proformas": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proformas_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_bills": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_bills_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_orders": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_orders_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"reminders": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_invoices": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_invoices_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_orders": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_orders_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settings_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"slabs": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "slabs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_advances": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_advances_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_invitations": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_invitations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_counts": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_counts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_transfers": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_transfers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"trade_partner_rules": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"payload": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trade_partner_rules_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "tilebook_accept_invites":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"tilebook_can_access_file":
{ Args: { "bucket": string,"folder": string,"writing": boolean }; Returns: boolean
                           },
"tilebook_health":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"tilebook_mutate":
{ Args: { "p_action": string,"p_business_id": string,"p_data": Json,"p_request_id": string,"p_resource": string }; Returns: Json
                           },
"tilebook_new_business":
{ Args: { "p_address": string,"p_name": string,"p_state": string }; Returns: string
                           },
"tilebook_portal":
{ Args: { "p_token": string }; Returns: Json
                           },
"tilebook_snapshot":
{ Args: { "p_business_id"?: string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
