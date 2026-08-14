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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      circuit_track_paths: {
        Row: {
          circuit_id: string
          path_data: string
          race_name: string | null
          rotation_degrees: number | null
          round: number | null
          season: number | null
          session_code: string | null
          source: string | null
        }
        Insert: {
          circuit_id: string
          path_data: string
          race_name?: string | null
          rotation_degrees?: number | null
          round?: number | null
          season?: number | null
          session_code?: string | null
          source?: string | null
        }
        Update: {
          circuit_id?: string
          path_data?: string
          race_name?: string | null
          rotation_degrees?: number | null
          round?: number | null
          season?: number | null
          session_code?: string | null
          source?: string | null
        }
        Relationships: []
      }
      circuits: {
        Row: {
          altitude_m: number | null
          circuit_code: string | null
          country: string | null
          high_speed_bias: number | null
          id: string
          lat: number | null
          lng: number | null
          location: string | null
          name: string
          overtake_difficulty: number | null
          tire_degradation_bias: number | null
          track_length_km: number | null
        }
        Insert: {
          altitude_m?: number | null
          circuit_code?: string | null
          country?: string | null
          high_speed_bias?: number | null
          id: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          name: string
          overtake_difficulty?: number | null
          tire_degradation_bias?: number | null
          track_length_km?: number | null
        }
        Update: {
          altitude_m?: number | null
          circuit_code?: string | null
          country?: string | null
          high_speed_bias?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          name?: string
          overtake_difficulty?: number | null
          tire_degradation_bias?: number | null
          track_length_km?: number | null
        }
        Relationships: []
      }
      constructor_features: {
        Row: {
          avg_finish_position_recent: number | null
          constructor_id: string
          degradation_profile: number | null
          id: string
          long_run_pace_s: number | null
          quali_pace_s: number | null
          race_id: string
          reliability_score: number | null
          round: number
          season: number
          source_label: string
          strategy_confidence: number | null
          strategy_tendency_score: number | null
          team_pace_s: number | null
          track_affinity_score: number | null
        }
        Insert: {
          avg_finish_position_recent?: number | null
          constructor_id: string
          degradation_profile?: number | null
          id: string
          long_run_pace_s?: number | null
          quali_pace_s?: number | null
          race_id: string
          reliability_score?: number | null
          round: number
          season: number
          source_label?: string
          strategy_confidence?: number | null
          strategy_tendency_score?: number | null
          team_pace_s?: number | null
          track_affinity_score?: number | null
        }
        Update: {
          avg_finish_position_recent?: number | null
          constructor_id?: string
          degradation_profile?: number | null
          id?: string
          long_run_pace_s?: number | null
          quali_pace_s?: number | null
          race_id?: string
          reliability_score?: number | null
          round?: number
          season?: number
          source_label?: string
          strategy_confidence?: number | null
          strategy_tendency_score?: number | null
          team_pace_s?: number | null
          track_affinity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "constructor_features_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constructor_features_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      constructor_form_snapshots: {
        Row: {
          constructor_id: string
          id: string
          race_id: string
          recent_pace_rank: number | null
          regulation_era: string
          reliability_index: number | null
          round: number
          season: number
          source_label: string
          two_car_long_run_pace_s: number | null
          two_car_quali_pace_s: number | null
          weather_risk_index: number | null
        }
        Insert: {
          constructor_id: string
          id: string
          race_id: string
          recent_pace_rank?: number | null
          regulation_era: string
          reliability_index?: number | null
          round: number
          season: number
          source_label: string
          two_car_long_run_pace_s?: number | null
          two_car_quali_pace_s?: number | null
          weather_risk_index?: number | null
        }
        Update: {
          constructor_id?: string
          id?: string
          race_id?: string
          recent_pace_rank?: number | null
          regulation_era?: string
          reliability_index?: number | null
          round?: number
          season?: number
          source_label?: string
          two_car_long_run_pace_s?: number | null
          two_car_quali_pace_s?: number | null
          weather_risk_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "constructor_form_snapshots_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constructor_form_snapshots_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      constructor_race_week_features: {
        Row: {
          constructor_id: string
          degradation_index: number | null
          id: string
          race_id: string
          readiness_score: number | null
          reliability_index: number | null
          round: number
          season: number
          signal_confidence: number | null
          source_label: string
          two_car_long_run_pace_s: number | null
          two_car_one_lap_pace_s: number | null
          weather_risk_index: number | null
        }
        Insert: {
          constructor_id: string
          degradation_index?: number | null
          id: string
          race_id: string
          readiness_score?: number | null
          reliability_index?: number | null
          round: number
          season: number
          signal_confidence?: number | null
          source_label?: string
          two_car_long_run_pace_s?: number | null
          two_car_one_lap_pace_s?: number | null
          weather_risk_index?: number | null
        }
        Update: {
          constructor_id?: string
          degradation_index?: number | null
          id?: string
          race_id?: string
          readiness_score?: number | null
          reliability_index?: number | null
          round?: number
          season?: number
          signal_confidence?: number | null
          source_label?: string
          two_car_long_run_pace_s?: number | null
          two_car_one_lap_pace_s?: number | null
          weather_risk_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "constructor_race_week_features_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constructor_race_week_features_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      constructor_signals: {
        Row: {
          constructor_id: string
          degradation_strength_signal: number | null
          id: string
          overall_signal: number | null
          pace_strength_signal: number | null
          race_id: string
          reliability_signal: number | null
          round: number
          season: number
          source_label: string
          strategy_signal: number | null
          track_affinity_signal: number | null
        }
        Insert: {
          constructor_id: string
          degradation_strength_signal?: number | null
          id: string
          overall_signal?: number | null
          pace_strength_signal?: number | null
          race_id: string
          reliability_signal?: number | null
          round: number
          season: number
          source_label?: string
          strategy_signal?: number | null
          track_affinity_signal?: number | null
        }
        Update: {
          constructor_id?: string
          degradation_strength_signal?: number | null
          id?: string
          overall_signal?: number | null
          pace_strength_signal?: number | null
          race_id?: string
          reliability_signal?: number | null
          round?: number
          season?: number
          source_label?: string
          strategy_signal?: number | null
          track_affinity_signal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "constructor_signals_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constructor_signals_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      constructor_standings: {
        Row: {
          constructor_id: string
          id: string
          points: number
          race_id: string
          round: number
          season: number
          source_label: string
          standing_position: number
          wins: number
        }
        Insert: {
          constructor_id: string
          id: string
          points?: number
          race_id: string
          round: number
          season: number
          source_label: string
          standing_position: number
          wins?: number
        }
        Update: {
          constructor_id?: string
          id?: string
          points?: number
          race_id?: string
          round?: number
          season?: number
          source_label?: string
          standing_position?: number
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "constructor_standings_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constructor_standings_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      constructor_strategy_profile: {
        Row: {
          confidence_score: number | null
          constructor_id: string
          double_stack_risk_score: number | null
          id: string
          pit_efficiency_score: number | null
          pit_loss_adjustment_s: number | null
          race_id: string
          round: number
          season: number
          source_label: string
          strategy_success_proxy: number | null
        }
        Insert: {
          confidence_score?: number | null
          constructor_id: string
          double_stack_risk_score?: number | null
          id: string
          pit_efficiency_score?: number | null
          pit_loss_adjustment_s?: number | null
          race_id: string
          round: number
          season: number
          source_label?: string
          strategy_success_proxy?: number | null
        }
        Update: {
          confidence_score?: number | null
          constructor_id?: string
          double_stack_risk_score?: number | null
          id?: string
          pit_efficiency_score?: number | null
          pit_loss_adjustment_s?: number | null
          race_id?: string
          round?: number
          season?: number
          source_label?: string
          strategy_success_proxy?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "constructor_strategy_profile_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constructor_strategy_profile_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      constructors: {
        Row: {
          constructor_code: string | null
          id: string
          name: string
          nationality: string | null
        }
        Insert: {
          constructor_code?: string | null
          id: string
          name: string
          nationality?: string | null
        }
        Update: {
          constructor_code?: string | null
          id?: string
          name?: string
          nationality?: string | null
        }
        Relationships: []
      }
      driver_features: {
        Row: {
          avg_finish_position_recent: number | null
          avg_quali_yoy_delta_s: number | null
          avg_qualifying_position_recent: number | null
          avg_race_pace_s: number | null
          consistency_score: number | null
          constructor_id: string | null
          driver_id: string
          form_bias_score: number | null
          fp2_long_run_pace_s: number | null
          id: string
          lap_variance_s: number | null
          quali_pace_s: number | null
          race_id: string
          race_vs_quali_delta_s: number | null
          reliability_score: number | null
          round: number
          season: number
          source_label: string
          teammate_delta_s: number | null
          track_affinity_score: number | null
          tyre_degradation_slope: number | null
        }
        Insert: {
          avg_finish_position_recent?: number | null
          avg_quali_yoy_delta_s?: number | null
          avg_qualifying_position_recent?: number | null
          avg_race_pace_s?: number | null
          consistency_score?: number | null
          constructor_id?: string | null
          driver_id: string
          form_bias_score?: number | null
          fp2_long_run_pace_s?: number | null
          id: string
          lap_variance_s?: number | null
          quali_pace_s?: number | null
          race_id: string
          race_vs_quali_delta_s?: number | null
          reliability_score?: number | null
          round: number
          season: number
          source_label?: string
          teammate_delta_s?: number | null
          track_affinity_score?: number | null
          tyre_degradation_slope?: number | null
        }
        Update: {
          avg_finish_position_recent?: number | null
          avg_quali_yoy_delta_s?: number | null
          avg_qualifying_position_recent?: number | null
          avg_race_pace_s?: number | null
          consistency_score?: number | null
          constructor_id?: string | null
          driver_id?: string
          form_bias_score?: number | null
          fp2_long_run_pace_s?: number | null
          id?: string
          lap_variance_s?: number | null
          quali_pace_s?: number | null
          race_id?: string
          race_vs_quali_delta_s?: number | null
          reliability_score?: number | null
          round?: number
          season?: number
          source_label?: string
          teammate_delta_s?: number | null
          track_affinity_score?: number | null
          tyre_degradation_slope?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_features_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_features_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_features_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_form_snapshots: {
        Row: {
          constructor_id: string
          driver_id: string
          fp1_setup_gap_s: number | null
          fp2_degradation_s_per_lap: number | null
          fp2_long_run_pace_s: number | null
          fp3_short_run_pace_s: number | null
          id: string
          qualifying_pace_s: number | null
          race_id: string
          recent_gap_to_best_s: number | null
          recent_pace_rank: number | null
          regulation_era: string
          reliability_index: number | null
          round: number
          season: number
          season_weight: number | null
          session_completeness: number | null
          source_label: string
          teammate_delta_s: number | null
          top_speed_kph: number | null
          weather_risk_index: number | null
        }
        Insert: {
          constructor_id: string
          driver_id: string
          fp1_setup_gap_s?: number | null
          fp2_degradation_s_per_lap?: number | null
          fp2_long_run_pace_s?: number | null
          fp3_short_run_pace_s?: number | null
          id: string
          qualifying_pace_s?: number | null
          race_id: string
          recent_gap_to_best_s?: number | null
          recent_pace_rank?: number | null
          regulation_era: string
          reliability_index?: number | null
          round: number
          season: number
          season_weight?: number | null
          session_completeness?: number | null
          source_label: string
          teammate_delta_s?: number | null
          top_speed_kph?: number | null
          weather_risk_index?: number | null
        }
        Update: {
          constructor_id?: string
          driver_id?: string
          fp1_setup_gap_s?: number | null
          fp2_degradation_s_per_lap?: number | null
          fp2_long_run_pace_s?: number | null
          fp3_short_run_pace_s?: number | null
          id?: string
          qualifying_pace_s?: number | null
          race_id?: string
          recent_gap_to_best_s?: number | null
          recent_pace_rank?: number | null
          regulation_era?: string
          reliability_index?: number | null
          round?: number
          season?: number
          season_weight?: number | null
          session_completeness?: number | null
          source_label?: string
          teammate_delta_s?: number | null
          top_speed_kph?: number | null
          weather_risk_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_form_snapshots_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_form_snapshots_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_form_snapshots_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_race_week_features: {
        Row: {
          constructor_id: string
          driver_id: string
          fp2_degradation_s_per_lap: number | null
          fp2_long_run_pace_s: number | null
          gap_to_best_s: number | null
          id: string
          one_lap_pace_s: number | null
          one_lap_session_code: string | null
          overperforming_delta: number | null
          projected_finish: number | null
          race_id: string
          readiness_score: number | null
          recent_pace_rank: number | null
          reliability_index: number | null
          round: number
          season: number
          session_completeness: number | null
          signal_confidence: number | null
          source_label: string
          teammate_delta_s: number | null
          weather_risk_index: number | null
        }
        Insert: {
          constructor_id: string
          driver_id: string
          fp2_degradation_s_per_lap?: number | null
          fp2_long_run_pace_s?: number | null
          gap_to_best_s?: number | null
          id: string
          one_lap_pace_s?: number | null
          one_lap_session_code?: string | null
          overperforming_delta?: number | null
          projected_finish?: number | null
          race_id: string
          readiness_score?: number | null
          recent_pace_rank?: number | null
          reliability_index?: number | null
          round: number
          season: number
          session_completeness?: number | null
          signal_confidence?: number | null
          source_label?: string
          teammate_delta_s?: number | null
          weather_risk_index?: number | null
        }
        Update: {
          constructor_id?: string
          driver_id?: string
          fp2_degradation_s_per_lap?: number | null
          fp2_long_run_pace_s?: number | null
          gap_to_best_s?: number | null
          id?: string
          one_lap_pace_s?: number | null
          one_lap_session_code?: string | null
          overperforming_delta?: number | null
          projected_finish?: number | null
          race_id?: string
          readiness_score?: number | null
          recent_pace_rank?: number | null
          reliability_index?: number | null
          round?: number
          season?: number
          session_completeness?: number | null
          signal_confidence?: number | null
          source_label?: string
          teammate_delta_s?: number | null
          weather_risk_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_race_week_features_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_race_week_features_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_race_week_features_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_signals: {
        Row: {
          consistency_signal: number | null
          constructor_id: string | null
          driver_id: string
          form_bias_signal: number | null
          form_signal: number | null
          fp2_race_pace_signal: number | null
          id: string
          overall_signal: number | null
          quali_delta_signal: number | null
          quali_signal: number | null
          race_id: string
          racecraft_signal: number | null
          round: number
          season: number
          source_label: string
          track_affinity_signal: number | null
          trend_signal: number | null
        }
        Insert: {
          consistency_signal?: number | null
          constructor_id?: string | null
          driver_id: string
          form_bias_signal?: number | null
          form_signal?: number | null
          fp2_race_pace_signal?: number | null
          id: string
          overall_signal?: number | null
          quali_delta_signal?: number | null
          quali_signal?: number | null
          race_id: string
          racecraft_signal?: number | null
          round: number
          season: number
          source_label?: string
          track_affinity_signal?: number | null
          trend_signal?: number | null
        }
        Update: {
          consistency_signal?: number | null
          constructor_id?: string | null
          driver_id?: string
          form_bias_signal?: number | null
          form_signal?: number | null
          fp2_race_pace_signal?: number | null
          id?: string
          overall_signal?: number | null
          quali_delta_signal?: number | null
          quali_signal?: number | null
          race_id?: string
          racecraft_signal?: number | null
          round?: number
          season?: number
          source_label?: string
          track_affinity_signal?: number | null
          trend_signal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_signals_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_signals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_signals_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_standings: {
        Row: {
          constructor_id: string | null
          driver_id: string
          id: string
          points: number
          race_id: string
          round: number
          season: number
          source_label: string
          standing_position: number
          wins: number
        }
        Insert: {
          constructor_id?: string | null
          driver_id: string
          id: string
          points?: number
          race_id: string
          round: number
          season: number
          source_label: string
          standing_position: number
          wins?: number
        }
        Update: {
          constructor_id?: string | null
          driver_id?: string
          id?: string
          points?: number
          race_id?: string
          round?: number
          season?: number
          source_label?: string
          standing_position?: number
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_standings_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_standings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_standings_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_strategy_profile: {
        Row: {
          aggressive_tendency_score: number | null
          confidence_score: number | null
          constructor_id: string
          driver_id: string
          early_pit_bias_score: number | null
          id: string
          late_pit_bias_score: number | null
          race_id: string
          racecraft_proxy_score: number | null
          round: number
          season: number
          source_label: string
          tyre_management_score: number | null
        }
        Insert: {
          aggressive_tendency_score?: number | null
          confidence_score?: number | null
          constructor_id: string
          driver_id: string
          early_pit_bias_score?: number | null
          id: string
          late_pit_bias_score?: number | null
          race_id: string
          racecraft_proxy_score?: number | null
          round: number
          season: number
          source_label?: string
          tyre_management_score?: number | null
        }
        Update: {
          aggressive_tendency_score?: number | null
          confidence_score?: number | null
          constructor_id?: string
          driver_id?: string
          early_pit_bias_score?: number | null
          id?: string
          late_pit_bias_score?: number | null
          race_id?: string
          racecraft_proxy_score?: number | null
          round?: number
          season?: number
          source_label?: string
          tyre_management_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_strategy_profile_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_strategy_profile_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_strategy_profile_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          date_of_birth: string | null
          driver_code: string | null
          first_name: string
          full_name: string
          id: string
          last_name: string
          nationality: string | null
          permanent_number: number | null
        }
        Insert: {
          date_of_birth?: string | null
          driver_code?: string | null
          first_name: string
          full_name: string
          id: string
          last_name: string
          nationality?: string | null
          permanent_number?: number | null
        }
        Update: {
          date_of_birth?: string | null
          driver_code?: string | null
          first_name?: string
          full_name?: string
          id?: string
          last_name?: string
          nationality?: string | null
          permanent_number?: number | null
        }
        Relationships: []
      }
      event_entries: {
        Row: {
          constructor_id: string
          driver_id: string
          id: string
          race_id: string
          source_label: string
        }
        Insert: {
          constructor_id: string
          driver_id: string
          id: string
          race_id: string
          source_label?: string
        }
        Update: {
          constructor_id?: string
          driver_id?: string
          id?: string
          race_id?: string
          source_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_entries_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entries_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_inputs: {
        Row: {
          constructor_id: string | null
          entity_id: string
          entity_type: string
          id: string
          podium_probability: number
          price_estimate: number
          projected_score: number
          race_id: string
          round: number
          season: number
          source_label: string
          top10_probability: number
          value_score: number
          volatility_proxy: number
          winner_probability: number
        }
        Insert: {
          constructor_id?: string | null
          entity_id: string
          entity_type: string
          id: string
          podium_probability: number
          price_estimate: number
          projected_score: number
          race_id: string
          round: number
          season: number
          source_label: string
          top10_probability: number
          value_score: number
          volatility_proxy: number
          winner_probability: number
        }
        Update: {
          constructor_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          podium_probability?: number
          price_estimate?: number
          projected_score?: number
          race_id?: string
          round?: number
          season?: number
          source_label?: string
          top10_probability?: number
          value_score?: number
          volatility_proxy?: number
          winner_probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_inputs_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_pricing: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          price: number
          round: number | null
          season: number
          source_label: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          id: string
          price: number
          round?: number | null
          season: number
          source_label: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          price?: number
          round?: number | null
          season?: number
          source_label?: string
        }
        Relationships: []
      }
      fastf1_prediction_snapshots: {
        Row: {
          confidence_score: number | null
          constructor_id: string
          driver_id: string
          generated_at: string
          id: string
          model_version: string
          podium_probability: number
          predicted_score: number
          projected_finish: number
          race_id: string
          rationale: string | null
          round: number
          season: number
          source_label: string
          top10_probability: number
          winner_probability: number
        }
        Insert: {
          confidence_score?: number | null
          constructor_id: string
          driver_id: string
          generated_at: string
          id: string
          model_version: string
          podium_probability: number
          predicted_score: number
          projected_finish: number
          race_id: string
          rationale?: string | null
          round: number
          season: number
          source_label: string
          top10_probability: number
          winner_probability: number
        }
        Update: {
          confidence_score?: number | null
          constructor_id?: string
          driver_id?: string
          generated_at?: string
          id?: string
          model_version?: string
          podium_probability?: number
          predicted_score?: number
          projected_finish?: number
          race_id?: string
          rationale?: string | null
          round?: number
          season?: number
          source_label?: string
          top10_probability?: number
          winner_probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "fastf1_prediction_snapshots_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fastf1_prediction_snapshots_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fastf1_prediction_snapshots_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      fp2_long_run_summary: {
        Row: {
          compound: string | null
          constructor_id: string
          degradation_per_lap_s: number | null
          driver_id: string
          gap_to_best_s: number | null
          id: string
          lap_sample_size: number | null
          race_id: string
          representative_long_run_pace_s: number | null
          round: number
          season: number
          signal_confidence: number | null
          source_label: string
        }
        Insert: {
          compound?: string | null
          constructor_id: string
          degradation_per_lap_s?: number | null
          driver_id: string
          gap_to_best_s?: number | null
          id: string
          lap_sample_size?: number | null
          race_id: string
          representative_long_run_pace_s?: number | null
          round: number
          season: number
          signal_confidence?: number | null
          source_label?: string
        }
        Update: {
          compound?: string | null
          constructor_id?: string
          degradation_per_lap_s?: number | null
          driver_id?: string
          gap_to_best_s?: number | null
          id?: string
          lap_sample_size?: number | null
          race_id?: string
          representative_long_run_pace_s?: number | null
          round?: number
          season?: number
          signal_confidence?: number | null
          source_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "fp2_long_run_summary_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fp2_long_run_summary_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fp2_long_run_summary_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      model_features: {
        Row: {
          constructor_finish_avg_3: number | null
          constructor_id: string
          constructor_points_avg_3: number | null
          constructor_standing_position: number | null
          dnf_rate_5: number | null
          driver_id: string
          driver_standing_position: number | null
          field_status: string | null
          finish_consistency_5: number | null
          id: string
          latest_completed_race_id: string | null
          overtake_score: number | null
          race_id: string
          recent_finish_avg_3: number | null
          recent_points_avg_3: number | null
          recent_qualifying_avg_3: number | null
          reliability_score: number | null
          round: number
          season: number
          source_label: string
          teammate_points_delta_avg_3: number | null
        }
        Insert: {
          constructor_finish_avg_3?: number | null
          constructor_id: string
          constructor_points_avg_3?: number | null
          constructor_standing_position?: number | null
          dnf_rate_5?: number | null
          driver_id: string
          driver_standing_position?: number | null
          field_status?: string | null
          finish_consistency_5?: number | null
          id: string
          latest_completed_race_id?: string | null
          overtake_score?: number | null
          race_id: string
          recent_finish_avg_3?: number | null
          recent_points_avg_3?: number | null
          recent_qualifying_avg_3?: number | null
          reliability_score?: number | null
          round: number
          season: number
          source_label: string
          teammate_points_delta_avg_3?: number | null
        }
        Update: {
          constructor_finish_avg_3?: number | null
          constructor_id?: string
          constructor_points_avg_3?: number | null
          constructor_standing_position?: number | null
          dnf_rate_5?: number | null
          driver_id?: string
          driver_standing_position?: number | null
          field_status?: string | null
          finish_consistency_5?: number | null
          id?: string
          latest_completed_race_id?: string | null
          overtake_score?: number | null
          race_id?: string
          recent_finish_avg_3?: number | null
          recent_points_avg_3?: number | null
          recent_qualifying_avg_3?: number | null
          reliability_score?: number | null
          round?: number
          season?: number
          source_label?: string
          teammate_points_delta_avg_3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_features_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_features_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_features_latest_completed_race_id_fkey"
            columns: ["latest_completed_race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_features_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      pit_window: {
        Row: {
          compound_in: string | null
          compound_out: string | null
          constructor_id: string
          driver_id: string
          id: string
          race_id: string
          round: number
          scenario_code: string
          season: number
          source_label: string
          stop_number: number
          window_end_lap: number
          window_start_lap: number
        }
        Insert: {
          compound_in?: string | null
          compound_out?: string | null
          constructor_id: string
          driver_id: string
          id: string
          race_id: string
          round: number
          scenario_code: string
          season: number
          source_label?: string
          stop_number: number
          window_end_lap: number
          window_start_lap: number
        }
        Update: {
          compound_in?: string | null
          compound_out?: string | null
          constructor_id?: string
          driver_id?: string
          id?: string
          race_id?: string
          round?: number
          scenario_code?: string
          season?: number
          source_label?: string
          stop_number?: number
          window_end_lap?: number
          window_start_lap?: number
        }
        Relationships: [
          {
            foreignKeyName: "pit_window_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pit_window_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pit_window_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_feature_snapshots: {
        Row: {
          constructor_id: string
          constructor_long_run_pace_s: number | null
          constructor_quali_pace_s: number | null
          constructor_reliability_index: number | null
          driver_id: string
          driver_reliability_index: number | null
          fp1_setup_gap_s: number | null
          fp2_degradation_s_per_lap: number | null
          fp2_long_run_pace_s: number | null
          fp3_short_run_pace_s: number | null
          id: string
          qualifying_pace_s: number | null
          race_id: string
          recent_gap_to_best_s: number | null
          recent_pace_rank: number | null
          regulation_era: string
          round: number
          season: number
          session_completeness: number | null
          source_label: string
          teammate_delta_s: number | null
          weather_risk_index: number | null
        }
        Insert: {
          constructor_id: string
          constructor_long_run_pace_s?: number | null
          constructor_quali_pace_s?: number | null
          constructor_reliability_index?: number | null
          driver_id: string
          driver_reliability_index?: number | null
          fp1_setup_gap_s?: number | null
          fp2_degradation_s_per_lap?: number | null
          fp2_long_run_pace_s?: number | null
          fp3_short_run_pace_s?: number | null
          id: string
          qualifying_pace_s?: number | null
          race_id: string
          recent_gap_to_best_s?: number | null
          recent_pace_rank?: number | null
          regulation_era: string
          round: number
          season: number
          session_completeness?: number | null
          source_label: string
          teammate_delta_s?: number | null
          weather_risk_index?: number | null
        }
        Update: {
          constructor_id?: string
          constructor_long_run_pace_s?: number | null
          constructor_quali_pace_s?: number | null
          constructor_reliability_index?: number | null
          driver_id?: string
          driver_reliability_index?: number | null
          fp1_setup_gap_s?: number | null
          fp2_degradation_s_per_lap?: number | null
          fp2_long_run_pace_s?: number | null
          fp3_short_run_pace_s?: number | null
          id?: string
          qualifying_pace_s?: number | null
          race_id?: string
          recent_gap_to_best_s?: number | null
          recent_pace_rank?: number | null
          regulation_era?: string
          round?: number
          season?: number
          session_completeness?: number | null
          source_label?: string
          teammate_delta_s?: number | null
          weather_risk_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_feature_snapshots_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_feature_snapshots_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_feature_snapshots_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_signal_quality: {
        Row: {
          coverage_rate: number
          evidence_rows: number
          id: string
          prediction_mode: string
          quality_band: string
          race_id: string
          recommendation: string
          round: number
          season: number
          signal_key: string
          source_label: string
          usefulness_rank: number
          usefulness_score: number
        }
        Insert: {
          coverage_rate: number
          evidence_rows: number
          id: string
          prediction_mode?: string
          quality_band: string
          race_id: string
          recommendation: string
          round: number
          season: number
          signal_key: string
          source_label?: string
          usefulness_rank: number
          usefulness_score: number
        }
        Update: {
          coverage_rate?: number
          evidence_rows?: number
          id?: string
          prediction_mode?: string
          quality_band?: string
          race_id?: string
          recommendation?: string
          round?: number
          season?: number
          signal_key?: string
          source_label?: string
          usefulness_rank?: number
          usefulness_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "prediction_signal_quality_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_snapshots: {
        Row: {
          constructor_id: string
          driver_id: string
          generated_at: string
          id: string
          model_version: string
          podium_probability: number
          predicted_score: number
          projected_finish: number
          race_id: string
          rationale: string | null
          round: number
          season: number
          source_label: string
          top10_probability: number
          winner_probability: number
        }
        Insert: {
          constructor_id: string
          driver_id: string
          generated_at: string
          id: string
          model_version: string
          podium_probability: number
          predicted_score: number
          projected_finish: number
          race_id: string
          rationale?: string | null
          round: number
          season: number
          source_label: string
          top10_probability: number
          winner_probability: number
        }
        Update: {
          constructor_id?: string
          driver_id?: string
          generated_at?: string
          id?: string
          model_version?: string
          podium_probability?: number
          predicted_score?: number
          projected_finish?: number
          race_id?: string
          rationale?: string | null
          round?: number
          season?: number
          source_label?: string
          top10_probability?: number
          winner_probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "prediction_snapshots_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_snapshots_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_snapshots_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      qualifying_driver_deltas: {
        Row: {
          avg_quali_yoy_delta_s: number | null
          circuit_id: string
          comparison_constructor_id: string | null
          comparison_driver_id: string | null
          comparison_quali_gap_s: number | null
          constructor_id: string | null
          current_quali_gap_s: number | null
          delta_type: string
          driver_id: string
          id: string
          pairwise_delta_gap_s: number | null
          race_id: string
          round: number
          season: number
          source_label: string
          source_sample_size: number | null
        }
        Insert: {
          avg_quali_yoy_delta_s?: number | null
          circuit_id: string
          comparison_constructor_id?: string | null
          comparison_driver_id?: string | null
          comparison_quali_gap_s?: number | null
          constructor_id?: string | null
          current_quali_gap_s?: number | null
          delta_type: string
          driver_id: string
          id: string
          pairwise_delta_gap_s?: number | null
          race_id: string
          round: number
          season: number
          source_label?: string
          source_sample_size?: number | null
        }
        Update: {
          avg_quali_yoy_delta_s?: number | null
          circuit_id?: string
          comparison_constructor_id?: string | null
          comparison_driver_id?: string | null
          comparison_quali_gap_s?: number | null
          constructor_id?: string | null
          current_quali_gap_s?: number | null
          delta_type?: string
          driver_id?: string
          id?: string
          pairwise_delta_gap_s?: number | null
          race_id?: string
          round?: number
          season?: number
          source_label?: string
          source_sample_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qualifying_driver_deltas_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifying_driver_deltas_comparison_constructor_id_fkey"
            columns: ["comparison_constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifying_driver_deltas_comparison_driver_id_fkey"
            columns: ["comparison_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifying_driver_deltas_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifying_driver_deltas_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifying_driver_deltas_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      qualifying_results: {
        Row: {
          constructor_id: string
          driver_id: string
          id: string
          position: number | null
          q1_time_ms: number | null
          q2_time_ms: number | null
          q3_time_ms: number | null
          race_id: string
          status: string | null
        }
        Insert: {
          constructor_id: string
          driver_id: string
          id: string
          position?: number | null
          q1_time_ms?: number | null
          q2_time_ms?: number | null
          q3_time_ms?: number | null
          race_id: string
          status?: string | null
        }
        Update: {
          constructor_id?: string
          driver_id?: string
          id?: string
          position?: number | null
          q1_time_ms?: number | null
          q2_time_ms?: number | null
          q3_time_ms?: number | null
          race_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualifying_results_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifying_results_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifying_results_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_analysis_index: {
        Row: {
          analysis_quality_score: string | null
          build_version: string | null
          circuit: string | null
          classified_driver_count: string | null
          driver_count: string | null
          event: string | null
          freshness_status: string | null
          generated_at: string | null
          pit_stop_count: string | null
          race_analysis_id: string | null
          race_control_available: string | null
          race_date: string | null
          race_name: string | null
          round: string | null
          season: string | null
          session_id: string | null
          stint_count: string | null
          weather_available: string | null
          winner: string | null
          winner_team: string | null
        }
        Insert: {
          analysis_quality_score?: string | null
          build_version?: string | null
          circuit?: string | null
          classified_driver_count?: string | null
          driver_count?: string | null
          event?: string | null
          freshness_status?: string | null
          generated_at?: string | null
          pit_stop_count?: string | null
          race_analysis_id?: string | null
          race_control_available?: string | null
          race_date?: string | null
          race_name?: string | null
          round?: string | null
          season?: string | null
          session_id?: string | null
          stint_count?: string | null
          weather_available?: string | null
          winner?: string | null
          winner_team?: string | null
        }
        Update: {
          analysis_quality_score?: string | null
          build_version?: string | null
          circuit?: string | null
          classified_driver_count?: string | null
          driver_count?: string | null
          event?: string | null
          freshness_status?: string | null
          generated_at?: string | null
          pit_stop_count?: string | null
          race_analysis_id?: string | null
          race_control_available?: string | null
          race_date?: string | null
          race_name?: string | null
          round?: string | null
          season?: string | null
          session_id?: string | null
          stint_count?: string | null
          weather_available?: string | null
          winner?: string | null
          winner_team?: string | null
        }
        Relationships: []
      }
      race_analysis_links: {
        Row: {
          enabled: string | null
          href: string | null
          label: string | null
          race_analysis_id: string | null
          relevance_note: string | null
          surface: string | null
          unavailable_reason: string | null
        }
        Insert: {
          enabled?: string | null
          href?: string | null
          label?: string | null
          race_analysis_id?: string | null
          relevance_note?: string | null
          surface?: string | null
          unavailable_reason?: string | null
        }
        Update: {
          enabled?: string | null
          href?: string | null
          label?: string | null
          race_analysis_id?: string | null
          relevance_note?: string | null
          surface?: string | null
          unavailable_reason?: string | null
        }
        Relationships: []
      }
      race_analysis_neutralization_phases: {
        Row: {
          affected_laps: string | null
          cause_available: string | null
          cause_note: string | null
          confidence: string | null
          end_lap: string | null
          evidence_type: string | null
          phase_id: string | null
          race_analysis_id: string | null
          start_lap: string | null
          status_label: string | null
        }
        Insert: {
          affected_laps?: string | null
          cause_available?: string | null
          cause_note?: string | null
          confidence?: string | null
          end_lap?: string | null
          evidence_type?: string | null
          phase_id?: string | null
          race_analysis_id?: string | null
          start_lap?: string | null
          status_label?: string | null
        }
        Update: {
          affected_laps?: string | null
          cause_available?: string | null
          cause_note?: string | null
          confidence?: string | null
          end_lap?: string | null
          evidence_type?: string | null
          phase_id?: string | null
          race_analysis_id?: string | null
          start_lap?: string | null
          status_label?: string | null
        }
        Relationships: []
      }
      race_analysis_pace_evolution: {
        Row: {
          compound: string | null
          driver: string | null
          field_rank_on_lap: string | null
          fuel_corrected_delta_s: string | null
          lap_number: string | null
          lap_time_s: string | null
          normalized_pace_delta_s: string | null
          pace_confidence: string | null
          race_analysis_id: string | null
          race_phase: string | null
          rolling_pace_delta_s: string | null
          stint_number: string | null
          team: string | null
          tyre_age: string | null
          weather_adjusted_flag: string | null
        }
        Insert: {
          compound?: string | null
          driver?: string | null
          field_rank_on_lap?: string | null
          fuel_corrected_delta_s?: string | null
          lap_number?: string | null
          lap_time_s?: string | null
          normalized_pace_delta_s?: string | null
          pace_confidence?: string | null
          race_analysis_id?: string | null
          race_phase?: string | null
          rolling_pace_delta_s?: string | null
          stint_number?: string | null
          team?: string | null
          tyre_age?: string | null
          weather_adjusted_flag?: string | null
        }
        Update: {
          compound?: string | null
          driver?: string | null
          field_rank_on_lap?: string | null
          fuel_corrected_delta_s?: string | null
          lap_number?: string | null
          lap_time_s?: string | null
          normalized_pace_delta_s?: string | null
          pace_confidence?: string | null
          race_analysis_id?: string | null
          race_phase?: string | null
          rolling_pace_delta_s?: string | null
          stint_number?: string | null
          team?: string | null
          tyre_age?: string | null
          weather_adjusted_flag?: string | null
        }
        Relationships: []
      }
      race_analysis_pit_strategy: {
        Row: {
          compound_from: string | null
          compound_to: string | null
          confidence: string | null
          driver: string | null
          estimated_pit_loss_s: string | null
          net_position_change: string | null
          pit_lap: string | null
          pit_stop_number: string | null
          position_after_cycle: string | null
          position_before_pit: string | null
          race_analysis_id: string | null
          rejoin_risk: string | null
          stint_length_before: string | null
          strategy_effect: string | null
          team: string | null
          traffic_penalty_proxy_s: string | null
          undercut_overcut_label: string | null
          weakest_assumption: string | null
        }
        Insert: {
          compound_from?: string | null
          compound_to?: string | null
          confidence?: string | null
          driver?: string | null
          estimated_pit_loss_s?: string | null
          net_position_change?: string | null
          pit_lap?: string | null
          pit_stop_number?: string | null
          position_after_cycle?: string | null
          position_before_pit?: string | null
          race_analysis_id?: string | null
          rejoin_risk?: string | null
          stint_length_before?: string | null
          strategy_effect?: string | null
          team?: string | null
          traffic_penalty_proxy_s?: string | null
          undercut_overcut_label?: string | null
          weakest_assumption?: string | null
        }
        Update: {
          compound_from?: string | null
          compound_to?: string | null
          confidence?: string | null
          driver?: string | null
          estimated_pit_loss_s?: string | null
          net_position_change?: string | null
          pit_lap?: string | null
          pit_stop_number?: string | null
          position_after_cycle?: string | null
          position_before_pit?: string | null
          race_analysis_id?: string | null
          rejoin_risk?: string | null
          stint_length_before?: string | null
          strategy_effect?: string | null
          team?: string | null
          traffic_penalty_proxy_s?: string | null
          undercut_overcut_label?: string | null
          weakest_assumption?: string | null
        }
        Relationships: []
      }
      race_analysis_position_changes: {
        Row: {
          confidence: string | null
          driver: string | null
          finish_position: string | null
          largest_gain_phase: string | null
          largest_loss_phase: string | null
          net_position_change: string | null
          note: string | null
          position_volatility_score: string | null
          positions_gained_in_pit_cycles_proxy: string | null
          positions_gained_on_track_proxy: string | null
          race_analysis_id: string | null
          start_position: string | null
          team: string | null
        }
        Insert: {
          confidence?: string | null
          driver?: string | null
          finish_position?: string | null
          largest_gain_phase?: string | null
          largest_loss_phase?: string | null
          net_position_change?: string | null
          note?: string | null
          position_volatility_score?: string | null
          positions_gained_in_pit_cycles_proxy?: string | null
          positions_gained_on_track_proxy?: string | null
          race_analysis_id?: string | null
          start_position?: string | null
          team?: string | null
        }
        Update: {
          confidence?: string | null
          driver?: string | null
          finish_position?: string | null
          largest_gain_phase?: string | null
          largest_loss_phase?: string | null
          net_position_change?: string | null
          note?: string | null
          position_volatility_score?: string | null
          positions_gained_in_pit_cycles_proxy?: string | null
          positions_gained_on_track_proxy?: string | null
          race_analysis_id?: string | null
          start_position?: string | null
          team?: string | null
        }
        Relationships: []
      }
      race_analysis_position_swing_events: {
        Row: {
          confidence: string | null
          driver: string | null
          end_lap: string | null
          event_id: string | null
          event_type: string | null
          evidence_type: string | null
          note: string | null
          phase: string | null
          position_delta: string | null
          race_analysis_id: string | null
          start_lap: string | null
          team: string | null
        }
        Insert: {
          confidence?: string | null
          driver?: string | null
          end_lap?: string | null
          event_id?: string | null
          event_type?: string | null
          evidence_type?: string | null
          note?: string | null
          phase?: string | null
          position_delta?: string | null
          race_analysis_id?: string | null
          start_lap?: string | null
          team?: string | null
        }
        Update: {
          confidence?: string | null
          driver?: string | null
          end_lap?: string | null
          event_id?: string | null
          event_type?: string | null
          evidence_type?: string | null
          note?: string | null
          phase?: string | null
          position_delta?: string | null
          race_analysis_id?: string | null
          start_lap?: string | null
          team?: string | null
        }
        Relationships: []
      }
      race_analysis_position_timeline: {
        Row: {
          confidence: string | null
          driver: string | null
          evidence_type: string | null
          lap_number: string | null
          phase: string | null
          position: string | null
          position_delta_from_previous_lap: string | null
          position_delta_from_start: string | null
          race_analysis_id: string | null
          team: string | null
          track_status_label: string | null
        }
        Insert: {
          confidence?: string | null
          driver?: string | null
          evidence_type?: string | null
          lap_number?: string | null
          phase?: string | null
          position?: string | null
          position_delta_from_previous_lap?: string | null
          position_delta_from_start?: string | null
          race_analysis_id?: string | null
          team?: string | null
          track_status_label?: string | null
        }
        Update: {
          confidence?: string | null
          driver?: string | null
          evidence_type?: string | null
          lap_number?: string | null
          phase?: string | null
          position?: string | null
          position_delta_from_previous_lap?: string | null
          position_delta_from_start?: string | null
          race_analysis_id?: string | null
          team?: string | null
          track_status_label?: string | null
        }
        Relationships: []
      }
      race_analysis_stints: {
        Row: {
          avg_lap_time_s: string | null
          best_lap_time_s: string | null
          compound: string | null
          compound_phase: string | null
          degradation_confidence: string | null
          degradation_s_per_lap: string | null
          driver: string | null
          end_lap: string | null
          median_lap_time_s: string | null
          note: string | null
          pace_rank_in_stint: string | null
          race_analysis_id: string | null
          start_lap: string | null
          stint_length: string | null
          stint_number: string | null
          stint_quality_score: string | null
          team: string | null
          traffic_adjusted_flag: string | null
        }
        Insert: {
          avg_lap_time_s?: string | null
          best_lap_time_s?: string | null
          compound?: string | null
          compound_phase?: string | null
          degradation_confidence?: string | null
          degradation_s_per_lap?: string | null
          driver?: string | null
          end_lap?: string | null
          median_lap_time_s?: string | null
          note?: string | null
          pace_rank_in_stint?: string | null
          race_analysis_id?: string | null
          start_lap?: string | null
          stint_length?: string | null
          stint_number?: string | null
          stint_quality_score?: string | null
          team?: string | null
          traffic_adjusted_flag?: string | null
        }
        Update: {
          avg_lap_time_s?: string | null
          best_lap_time_s?: string | null
          compound?: string | null
          compound_phase?: string | null
          degradation_confidence?: string | null
          degradation_s_per_lap?: string | null
          driver?: string | null
          end_lap?: string | null
          median_lap_time_s?: string | null
          note?: string | null
          pace_rank_in_stint?: string | null
          race_analysis_id?: string | null
          start_lap?: string | null
          stint_length?: string | null
          stint_number?: string | null
          stint_quality_score?: string | null
          team?: string | null
          traffic_adjusted_flag?: string | null
        }
        Relationships: []
      }
      race_analysis_story_points: {
        Row: {
          confidence: string | null
          data_limit_note: string | null
          drivers_involved: string | null
          evidence_type: string | null
          impact_score: string | null
          lap_number: string | null
          phase: string | null
          race_analysis_id: string | null
          related_metric: string | null
          story_point_id: string | null
          summary: string | null
          teams_involved: string | null
          title: string | null
        }
        Insert: {
          confidence?: string | null
          data_limit_note?: string | null
          drivers_involved?: string | null
          evidence_type?: string | null
          impact_score?: string | null
          lap_number?: string | null
          phase?: string | null
          race_analysis_id?: string | null
          related_metric?: string | null
          story_point_id?: string | null
          summary?: string | null
          teams_involved?: string | null
          title?: string | null
        }
        Update: {
          confidence?: string | null
          data_limit_note?: string | null
          drivers_involved?: string | null
          evidence_type?: string | null
          impact_score?: string | null
          lap_number?: string | null
          phase?: string | null
          race_analysis_id?: string | null
          related_metric?: string | null
          story_point_id?: string | null
          summary?: string | null
          teams_involved?: string | null
          title?: string | null
        }
        Relationships: []
      }
      race_analysis_summary: {
        Row: {
          confidence: string | null
          dominant_strategy: string | null
          key_pace_factor: string | null
          key_position_factor: string | null
          key_strategy_factor: string | null
          podium: string | null
          primary_story: string | null
          race_analysis_id: string | null
          race_shape: string | null
          weakest_assumption: string | null
          weather_summary: string | null
          winner: string | null
          winner_team: string | null
          winning_compound_path: string | null
        }
        Insert: {
          confidence?: string | null
          dominant_strategy?: string | null
          key_pace_factor?: string | null
          key_position_factor?: string | null
          key_strategy_factor?: string | null
          podium?: string | null
          primary_story?: string | null
          race_analysis_id?: string | null
          race_shape?: string | null
          weakest_assumption?: string | null
          weather_summary?: string | null
          winner?: string | null
          winner_team?: string | null
          winning_compound_path?: string | null
        }
        Update: {
          confidence?: string | null
          dominant_strategy?: string | null
          key_pace_factor?: string | null
          key_position_factor?: string | null
          key_strategy_factor?: string | null
          podium?: string | null
          primary_story?: string | null
          race_analysis_id?: string | null
          race_shape?: string | null
          weakest_assumption?: string | null
          weather_summary?: string | null
          winner?: string | null
          winner_team?: string | null
          winning_compound_path?: string | null
        }
        Relationships: []
      }
      race_analysis_track_status: {
        Row: {
          confidence: string | null
          lap_number: string | null
          note: string | null
          phase: string | null
          race_analysis_id: string | null
          source: string | null
          track_status_label: string | null
          track_status_raw: string | null
        }
        Insert: {
          confidence?: string | null
          lap_number?: string | null
          note?: string | null
          phase?: string | null
          race_analysis_id?: string | null
          source?: string | null
          track_status_label?: string | null
          track_status_raw?: string | null
        }
        Update: {
          confidence?: string | null
          lap_number?: string | null
          note?: string | null
          phase?: string | null
          race_analysis_id?: string | null
          source?: string | null
          track_status_label?: string | null
          track_status_raw?: string | null
        }
        Relationships: []
      }
      race_analysis_traffic_proxy: {
        Row: {
          confidence: string | null
          dirty_air_proxy_s: string | null
          driver: string | null
          drs_window_proxy: string | null
          evidence_type: string | null
          lap_number: string | null
          lap_time_s: string | null
          normalized_pace_delta_s: string | null
          note: string | null
          phase: string | null
          position: string | null
          race_analysis_id: string | null
          team: string | null
          traffic_proxy_label: string | null
        }
        Insert: {
          confidence?: string | null
          dirty_air_proxy_s?: string | null
          driver?: string | null
          drs_window_proxy?: string | null
          evidence_type?: string | null
          lap_number?: string | null
          lap_time_s?: string | null
          normalized_pace_delta_s?: string | null
          note?: string | null
          phase?: string | null
          position?: string | null
          race_analysis_id?: string | null
          team?: string | null
          traffic_proxy_label?: string | null
        }
        Update: {
          confidence?: string | null
          dirty_air_proxy_s?: string | null
          driver?: string | null
          drs_window_proxy?: string | null
          evidence_type?: string | null
          lap_number?: string | null
          lap_time_s?: string | null
          normalized_pace_delta_s?: string | null
          note?: string | null
          phase?: string | null
          position?: string | null
          race_analysis_id?: string | null
          team?: string | null
          traffic_proxy_label?: string | null
        }
        Relationships: []
      }
      race_analysis_weather_context: {
        Row: {
          air_temp_c: string | null
          confidence: string | null
          humidity_pct: string | null
          lap_number: string | null
          race_analysis_id: string | null
          race_phase: string | null
          rainfall: string | null
          track_temp_c: string | null
          track_temp_delta_from_start_c: string | null
          weather_impact_label: string | null
          weather_state: string | null
          wind_speed_mps: string | null
        }
        Insert: {
          air_temp_c?: string | null
          confidence?: string | null
          humidity_pct?: string | null
          lap_number?: string | null
          race_analysis_id?: string | null
          race_phase?: string | null
          rainfall?: string | null
          track_temp_c?: string | null
          track_temp_delta_from_start_c?: string | null
          weather_impact_label?: string | null
          weather_state?: string | null
          wind_speed_mps?: string | null
        }
        Update: {
          air_temp_c?: string | null
          confidence?: string | null
          humidity_pct?: string | null
          lap_number?: string | null
          race_analysis_id?: string | null
          race_phase?: string | null
          rainfall?: string | null
          track_temp_c?: string | null
          track_temp_delta_from_start_c?: string | null
          weather_impact_label?: string | null
          weather_state?: string | null
          wind_speed_mps?: string | null
        }
        Relationships: []
      }
      race_context_features: {
        Row: {
          archetype_label: string | null
          circuit_id: string
          high_speed_bias: number | null
          id: string
          overtake_difficulty: number | null
          race_id: string
          round: number
          safety_car_probability: number | null
          season: number
          source_label: string
          strategic_complexity_score: number | null
          tire_degradation_bias: number | null
          weather_risk_index: number | null
        }
        Insert: {
          archetype_label?: string | null
          circuit_id: string
          high_speed_bias?: number | null
          id: string
          overtake_difficulty?: number | null
          race_id: string
          round: number
          safety_car_probability?: number | null
          season: number
          source_label?: string
          strategic_complexity_score?: number | null
          tire_degradation_bias?: number | null
          weather_risk_index?: number | null
        }
        Update: {
          archetype_label?: string | null
          circuit_id?: string
          high_speed_bias?: number | null
          id?: string
          overtake_difficulty?: number | null
          race_id?: string
          round?: number
          safety_car_probability?: number | null
          season?: number
          source_label?: string
          strategic_complexity_score?: number | null
          tire_degradation_bias?: number | null
          weather_risk_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_context_features_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_context_features_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_context_signals: {
        Row: {
          high_speed_signal: number | null
          id: string
          overtaking_signal: number | null
          race_id: string
          round: number
          safety_car_signal: number | null
          season: number
          source_label: string
          strategic_complexity_signal: number | null
          weather_signal: number | null
        }
        Insert: {
          high_speed_signal?: number | null
          id: string
          overtaking_signal?: number | null
          race_id: string
          round: number
          safety_car_signal?: number | null
          season: number
          source_label?: string
          strategic_complexity_signal?: number | null
          weather_signal?: number | null
        }
        Update: {
          high_speed_signal?: number | null
          id?: string
          overtaking_signal?: number | null
          race_id?: string
          round?: number
          safety_car_signal?: number | null
          season?: number
          source_label?: string
          strategic_complexity_signal?: number | null
          weather_signal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_context_signals_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_pick_challenges: {
        Row: {
          created_at: string
          qualifying_lock_at: string
          race_id: string
          random_position_1: number
          random_position_2: number
          random_position_3: number
          round: number
          season: number
          source_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          qualifying_lock_at: string
          race_id: string
          random_position_1: number
          random_position_2: number
          random_position_3: number
          round: number
          season: number
          source_label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          qualifying_lock_at?: string
          race_id?: string
          random_position_1?: number
          random_position_2?: number
          random_position_3?: number
          round?: number
          season?: number
          source_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_pick_challenges_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: true
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_pit_stop_results: {
        Row: {
          created_at: string
          driver_id: string
          pit_duration_s: number
          race_id: string
          round: number
          season: number
          source_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          pit_duration_s: number
          race_id: string
          round: number
          season: number
          source_label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          pit_duration_s?: number
          race_id?: string
          round?: number
          season?: number
          source_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_pit_stop_results_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_pit_stop_results_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: true
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_projection: {
        Row: {
          baseline_strategy_code: string | null
          baseline_total_time_s: number | null
          confidence_score: number | null
          constructor_id: string
          driver_id: string
          finish_band_high: number | null
          finish_band_low: number | null
          id: string
          podium_probability: number | null
          projected_finish: number | null
          race_id: string
          round: number
          season: number
          source_label: string
          win_probability: number | null
        }
        Insert: {
          baseline_strategy_code?: string | null
          baseline_total_time_s?: number | null
          confidence_score?: number | null
          constructor_id: string
          driver_id: string
          finish_band_high?: number | null
          finish_band_low?: number | null
          id: string
          podium_probability?: number | null
          projected_finish?: number | null
          race_id: string
          round: number
          season: number
          source_label?: string
          win_probability?: number | null
        }
        Update: {
          baseline_strategy_code?: string | null
          baseline_total_time_s?: number | null
          confidence_score?: number | null
          constructor_id?: string
          driver_id?: string
          finish_band_high?: number | null
          finish_band_low?: number | null
          id?: string
          podium_probability?: number | null
          projected_finish?: number | null
          race_id?: string
          round?: number
          season?: number
          source_label?: string
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_projection_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_projection_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_projection_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_results: {
        Row: {
          constructor_id: string
          driver_id: string
          fastest_lap_rank: number | null
          finish_position: number | null
          finish_status: string | null
          grid_position: number | null
          id: string
          laps_completed: number | null
          points: number
          race_id: string
        }
        Insert: {
          constructor_id: string
          driver_id: string
          fastest_lap_rank?: number | null
          finish_position?: number | null
          finish_status?: string | null
          grid_position?: number | null
          id: string
          laps_completed?: number | null
          points?: number
          race_id: string
        }
        Update: {
          constructor_id?: string
          driver_id?: string
          fastest_lap_rank?: number | null
          finish_position?: number | null
          finish_status?: string | null
          grid_position?: number | null
          id?: string
          laps_completed?: number | null
          points?: number
          race_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_results_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_confidence: {
        Row: {
          agreement_score: number | null
          completeness_score: number | null
          confidence_band: string | null
          confidence_score: number | null
          entity_id: string
          entity_type: string
          id: string
          race_id: string
          rationale: string | null
          round: number
          sample_score: number | null
          season: number
          source_label: string
          strength_score: number | null
        }
        Insert: {
          agreement_score?: number | null
          completeness_score?: number | null
          confidence_band?: string | null
          confidence_score?: number | null
          entity_id: string
          entity_type: string
          id: string
          race_id: string
          rationale?: string | null
          round: number
          sample_score?: number | null
          season: number
          source_label?: string
          strength_score?: number | null
        }
        Update: {
          agreement_score?: number | null
          completeness_score?: number | null
          confidence_band?: string | null
          confidence_score?: number | null
          entity_id?: string
          entity_type?: string
          id?: string
          race_id?: string
          rationale?: string | null
          round?: number
          sample_score?: number | null
          season?: number
          source_label?: string
          strength_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_confidence_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_constructor_board: {
        Row: {
          constructor_id: string
          constructor_name: string
          degradation_index: number | null
          id: string
          long_run_pace_s: number | null
          one_lap_pace_s: number | null
          race_id: string
          readiness_score: number | null
          round: number
          season: number
          signal_confidence: number | null
          source_label: string
          summary: string | null
        }
        Insert: {
          constructor_id: string
          constructor_name: string
          degradation_index?: number | null
          id: string
          long_run_pace_s?: number | null
          one_lap_pace_s?: number | null
          race_id: string
          readiness_score?: number | null
          round: number
          season: number
          signal_confidence?: number | null
          source_label?: string
          summary?: string | null
        }
        Update: {
          constructor_id?: string
          constructor_name?: string
          degradation_index?: number | null
          id?: string
          long_run_pace_s?: number | null
          one_lap_pace_s?: number | null
          race_id?: string
          readiness_score?: number | null
          round?: number
          season?: number
          signal_confidence?: number | null
          source_label?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_constructor_board_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_constructor_board_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_context: {
        Row: {
          circuit_id: string
          id: string
          is_next_race: boolean
          latest_completed_race_id: string | null
          latest_completed_race_name: string | null
          latest_completed_round: number | null
          latest_completed_season: number | null
          race_id: string
          race_name: string
          round: number
          scheduled_at: string | null
          season: number
          source_label: string
          status: string
        }
        Insert: {
          circuit_id: string
          id: string
          is_next_race?: boolean
          latest_completed_race_id?: string | null
          latest_completed_race_name?: string | null
          latest_completed_round?: number | null
          latest_completed_season?: number | null
          race_id: string
          race_name: string
          round: number
          scheduled_at?: string | null
          season: number
          source_label: string
          status: string
        }
        Update: {
          circuit_id?: string
          id?: string
          is_next_race?: boolean
          latest_completed_race_id?: string | null
          latest_completed_race_name?: string | null
          latest_completed_round?: number | null
          latest_completed_season?: number | null
          race_id?: string
          race_name?: string
          round?: number
          scheduled_at?: string | null
          season?: number
          source_label?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_week_context_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_context_latest_completed_race_id_fkey"
            columns: ["latest_completed_race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_context_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_driver_board: {
        Row: {
          constructor_id: string
          constructor_name: string
          degradation_s_per_lap: number | null
          driver_id: string
          driver_name: string
          gap_to_long_run_best_s: number | null
          gap_to_one_lap_best_s: number | null
          id: string
          long_run_pace_s: number | null
          one_lap_pace_s: number | null
          projected_finish: number | null
          race_id: string
          readiness_score: number | null
          round: number
          season: number
          signal_confidence: number | null
          source_label: string
          summary: string | null
        }
        Insert: {
          constructor_id: string
          constructor_name: string
          degradation_s_per_lap?: number | null
          driver_id: string
          driver_name: string
          gap_to_long_run_best_s?: number | null
          gap_to_one_lap_best_s?: number | null
          id: string
          long_run_pace_s?: number | null
          one_lap_pace_s?: number | null
          projected_finish?: number | null
          race_id: string
          readiness_score?: number | null
          round: number
          season: number
          signal_confidence?: number | null
          source_label?: string
          summary?: string | null
        }
        Update: {
          constructor_id?: string
          constructor_name?: string
          degradation_s_per_lap?: number | null
          driver_id?: string
          driver_name?: string
          gap_to_long_run_best_s?: number | null
          gap_to_one_lap_best_s?: number | null
          id?: string
          long_run_pace_s?: number | null
          one_lap_pace_s?: number | null
          projected_finish?: number | null
          race_id?: string
          readiness_score?: number | null
          round?: number
          season?: number
          signal_confidence?: number | null
          source_label?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_driver_board_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_driver_board_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_driver_board_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_overview: {
        Row: {
          archetype_label: string | null
          build_version: string | null
          circuit_id: string
          circuit_name: string
          generated_at: string | null
          id: string
          latest_completed_race_id: string | null
          race_id: string
          race_name: string
          round: number
          scheduled_at: string | null
          season: number
          signal_confidence: number | null
          source_label: string
          sprint_weekend: boolean | null
          status: string
          strategy_difficulty: string | null
          weather_risk_index: number | null
        }
        Insert: {
          archetype_label?: string | null
          build_version?: string | null
          circuit_id: string
          circuit_name: string
          generated_at?: string | null
          id: string
          latest_completed_race_id?: string | null
          race_id: string
          race_name: string
          round: number
          scheduled_at?: string | null
          season: number
          signal_confidence?: number | null
          source_label?: string
          sprint_weekend?: boolean | null
          status: string
          strategy_difficulty?: string | null
          weather_risk_index?: number | null
        }
        Update: {
          archetype_label?: string | null
          build_version?: string | null
          circuit_id?: string
          circuit_name?: string
          generated_at?: string | null
          id?: string
          latest_completed_race_id?: string | null
          race_id?: string
          race_name?: string
          round?: number
          scheduled_at?: string | null
          season?: number
          signal_confidence?: number | null
          source_label?: string
          sprint_weekend?: boolean | null
          status?: string
          strategy_difficulty?: string | null
          weather_risk_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_overview_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_overview_latest_completed_race_id_fkey"
            columns: ["latest_completed_race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_overview_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_storylines: {
        Row: {
          body: string
          confidence_band: string
          entity_id: string | null
          entity_type: string
          headline: string
          id: string
          priority_rank: number
          published_at: string | null
          race_id: string
          round: number
          season: number
          signal_confidence: number | null
          source_label: string
          source_title: string | null
          source_url: string | null
          storyline_type: string
        }
        Insert: {
          body: string
          confidence_band: string
          entity_id?: string | null
          entity_type: string
          headline: string
          id: string
          priority_rank: number
          published_at?: string | null
          race_id: string
          round: number
          season: number
          signal_confidence?: number | null
          source_label?: string
          source_title?: string | null
          source_url?: string | null
          storyline_type: string
        }
        Update: {
          body?: string
          confidence_band?: string
          entity_id?: string | null
          entity_type?: string
          headline?: string
          id?: string
          priority_rank?: number
          published_at?: string | null
          race_id?: string
          round?: number
          season?: number
          signal_confidence?: number | null
          source_label?: string
          source_title?: string | null
          source_url?: string | null
          storyline_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_week_storylines_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_strategy: {
        Row: {
          constructor_id: string
          degradation_risk: number | null
          driver_id: string
          id: string
          pit_window_end_lap: number | null
          pit_window_start_lap: number | null
          preferred_primary_compound: string | null
          preferred_secondary_compound: string | null
          race_id: string
          rationale: string | null
          recommended_stop_count: number | null
          round: number
          season: number
          source_label: string
          strategy_confidence: number | null
        }
        Insert: {
          constructor_id: string
          degradation_risk?: number | null
          driver_id: string
          id: string
          pit_window_end_lap?: number | null
          pit_window_start_lap?: number | null
          preferred_primary_compound?: string | null
          preferred_secondary_compound?: string | null
          race_id: string
          rationale?: string | null
          recommended_stop_count?: number | null
          round: number
          season: number
          source_label?: string
          strategy_confidence?: number | null
        }
        Update: {
          constructor_id?: string
          degradation_risk?: number | null
          driver_id?: string
          id?: string
          pit_window_end_lap?: number | null
          pit_window_start_lap?: number | null
          preferred_primary_compound?: string | null
          preferred_secondary_compound?: string | null
          race_id?: string
          rationale?: string | null
          recommended_stop_count?: number | null
          round?: number
          season?: number
          source_label?: string
          strategy_confidence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_strategy_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_strategy_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_strategy_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      races: {
        Row: {
          circuit_id: string
          id: string
          official_name: string | null
          race_name: string
          round: number
          scheduled_at: string
          season: number
          sprint_weekend: boolean
        }
        Insert: {
          circuit_id: string
          id: string
          official_name?: string | null
          race_name: string
          round: number
          scheduled_at: string
          season: number
          sprint_weekend?: boolean
        }
        Update: {
          circuit_id?: string
          id?: string
          official_name?: string | null
          race_name?: string
          round?: number
          scheduled_at?: string
          season?: number
          sprint_weekend?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "races_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
        ]
      }
      session_features: {
        Row: {
          constructor_id: string | null
          driver_id: string
          fp1_pace_s: number | null
          fp2_long_run_pace_s: number | null
          fp2_pace_s: number | null
          fp3_pace_s: number | null
          id: string
          lap_variance_s: number | null
          quali_pace_s: number | null
          race_id: string
          round: number
          season: number
          session_completeness: number | null
          session_trend_delta_s: number | null
          signal_confidence: number | null
          source_label: string
        }
        Insert: {
          constructor_id?: string | null
          driver_id: string
          fp1_pace_s?: number | null
          fp2_long_run_pace_s?: number | null
          fp2_pace_s?: number | null
          fp3_pace_s?: number | null
          id: string
          lap_variance_s?: number | null
          quali_pace_s?: number | null
          race_id: string
          round: number
          season: number
          session_completeness?: number | null
          session_trend_delta_s?: number | null
          signal_confidence?: number | null
          source_label?: string
        }
        Update: {
          constructor_id?: string | null
          driver_id?: string
          fp1_pace_s?: number | null
          fp2_long_run_pace_s?: number | null
          fp2_pace_s?: number | null
          fp3_pace_s?: number | null
          id?: string
          lap_variance_s?: number | null
          quali_pace_s?: number | null
          race_id?: string
          round?: number
          season?: number
          session_completeness?: number | null
          session_trend_delta_s?: number | null
          signal_confidence?: number | null
          source_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_features_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_features_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_features_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      session_laps: {
        Row: {
          air_temp_c: number | null
          compound: string | null
          constructor_id: string | null
          deleted: boolean | null
          driver_id: string | null
          event_entry_id: string | null
          fresh_tyre: boolean | null
          humidity_pct: number | null
          id: string
          is_accurate: boolean | null
          is_personal_best: boolean | null
          lap_number: number | null
          lap_start_time: string | null
          lap_time_s: number | null
          position: number | null
          race_id: string
          rainfall: boolean | null
          sector_1_s: number | null
          sector_2_s: number | null
          sector_3_s: number | null
          session_id: string
          source_label: string
          stint_number: number | null
          top_speed_kph: number | null
          track_status: string | null
          track_temp_c: number | null
          tyre_life: number | null
          wind_direction_deg: number | null
          wind_speed_mps: number | null
        }
        Insert: {
          air_temp_c?: number | null
          compound?: string | null
          constructor_id?: string | null
          deleted?: boolean | null
          driver_id?: string | null
          event_entry_id?: string | null
          fresh_tyre?: boolean | null
          humidity_pct?: number | null
          id: string
          is_accurate?: boolean | null
          is_personal_best?: boolean | null
          lap_number?: number | null
          lap_start_time?: string | null
          lap_time_s?: number | null
          position?: number | null
          race_id: string
          rainfall?: boolean | null
          sector_1_s?: number | null
          sector_2_s?: number | null
          sector_3_s?: number | null
          session_id: string
          source_label?: string
          stint_number?: number | null
          top_speed_kph?: number | null
          track_status?: string | null
          track_temp_c?: number | null
          tyre_life?: number | null
          wind_direction_deg?: number | null
          wind_speed_mps?: number | null
        }
        Update: {
          air_temp_c?: number | null
          compound?: string | null
          constructor_id?: string | null
          deleted?: boolean | null
          driver_id?: string | null
          event_entry_id?: string | null
          fresh_tyre?: boolean | null
          humidity_pct?: number | null
          id?: string
          is_accurate?: boolean | null
          is_personal_best?: boolean | null
          lap_number?: number | null
          lap_start_time?: string | null
          lap_time_s?: number | null
          position?: number | null
          race_id?: string
          rainfall?: boolean | null
          sector_1_s?: number | null
          sector_2_s?: number | null
          sector_3_s?: number | null
          session_id?: string
          source_label?: string
          stint_number?: number | null
          top_speed_kph?: number | null
          track_status?: string | null
          track_temp_c?: number | null
          tyre_life?: number | null
          wind_direction_deg?: number | null
          wind_speed_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_laps_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_laps_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_laps_event_entry_id_fkey"
            columns: ["event_entry_id"]
            isOneToOne: false
            referencedRelation: "event_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_laps_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_laps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_pace_summary: {
        Row: {
          air_temp_c: number | null
          best_lap_s: number | null
          constructor_id: string
          driver_id: string
          gap_to_session_best_s: number | null
          gap_to_teammate_s: number | null
          id: string
          long_run_degradation_s: number | null
          long_run_lap_s: number | null
          pace_rank: number | null
          race_id: string
          rainfall_flag: boolean | null
          representative_lap_s: number | null
          round: number
          season: number
          session_code: string
          session_id: string
          source_label: string
          top_speed_kph: number | null
          track_temp_c: number | null
        }
        Insert: {
          air_temp_c?: number | null
          best_lap_s?: number | null
          constructor_id: string
          driver_id: string
          gap_to_session_best_s?: number | null
          gap_to_teammate_s?: number | null
          id: string
          long_run_degradation_s?: number | null
          long_run_lap_s?: number | null
          pace_rank?: number | null
          race_id: string
          rainfall_flag?: boolean | null
          representative_lap_s?: number | null
          round: number
          season: number
          session_code: string
          session_id: string
          source_label?: string
          top_speed_kph?: number | null
          track_temp_c?: number | null
        }
        Update: {
          air_temp_c?: number | null
          best_lap_s?: number | null
          constructor_id?: string
          driver_id?: string
          gap_to_session_best_s?: number | null
          gap_to_teammate_s?: number | null
          id?: string
          long_run_degradation_s?: number | null
          long_run_lap_s?: number | null
          pace_rank?: number | null
          race_id?: string
          rainfall_flag?: boolean | null
          representative_lap_s?: number | null
          round?: number
          season?: number
          session_code?: string
          session_id?: string
          source_label?: string
          top_speed_kph?: number | null
          track_temp_c?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_pace_summary_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_pace_summary_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_pace_summary_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_pace_summary_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_results: {
        Row: {
          classification_position: number | null
          constructor_id: string
          driver_id: string
          event_entry_id: string
          fastest_lap_rank: number | null
          finish_position: number | null
          grid_position: number | null
          id: string
          laps_completed: number | null
          points: number | null
          race_id: string
          session_id: string
          source_label: string
          status: string | null
        }
        Insert: {
          classification_position?: number | null
          constructor_id: string
          driver_id: string
          event_entry_id: string
          fastest_lap_rank?: number | null
          finish_position?: number | null
          grid_position?: number | null
          id: string
          laps_completed?: number | null
          points?: number | null
          race_id: string
          session_id: string
          source_label?: string
          status?: string | null
        }
        Update: {
          classification_position?: number | null
          constructor_id?: string
          driver_id?: string
          event_entry_id?: string
          fastest_lap_rank?: number | null
          finish_position?: number | null
          grid_position?: number | null
          id?: string
          laps_completed?: number | null
          points?: number | null
          race_id?: string
          session_id?: string
          source_label?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_results_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_results_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_results_event_entry_id_fkey"
            columns: ["event_entry_id"]
            isOneToOne: false
            referencedRelation: "event_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_results_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_stints: {
        Row: {
          compound: string | null
          constructor_id: string | null
          degradation_index: number | null
          degradation_per_lap_s: number | null
          driver_id: string | null
          end_tyre_life: number | null
          event_entry_id: string | null
          id: string
          lap_count: number | null
          mean_lap_time_s: number | null
          race_id: string
          session_code: string | null
          session_id: string
          source_label: string
          start_tyre_life: number | null
          stint_number: number | null
        }
        Insert: {
          compound?: string | null
          constructor_id?: string | null
          degradation_index?: number | null
          degradation_per_lap_s?: number | null
          driver_id?: string | null
          end_tyre_life?: number | null
          event_entry_id?: string | null
          id: string
          lap_count?: number | null
          mean_lap_time_s?: number | null
          race_id: string
          session_code?: string | null
          session_id: string
          source_label?: string
          start_tyre_life?: number | null
          stint_number?: number | null
        }
        Update: {
          compound?: string | null
          constructor_id?: string | null
          degradation_index?: number | null
          degradation_per_lap_s?: number | null
          driver_id?: string | null
          end_tyre_life?: number | null
          event_entry_id?: string | null
          id?: string
          lap_count?: number | null
          mean_lap_time_s?: number | null
          race_id?: string
          session_code?: string | null
          session_id?: string
          source_label?: string
          start_tyre_life?: number | null
          stint_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_stints_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_stints_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_stints_event_entry_id_fkey"
            columns: ["event_entry_id"]
            isOneToOne: false
            referencedRelation: "event_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_stints_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_stints_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_weather: {
        Row: {
          air_temp_c: number | null
          humidity_pct: number | null
          id: string
          pressure_hpa: number | null
          race_id: string
          rainfall: boolean | null
          sample_order: number
          sample_time: string | null
          session_id: string
          source_label: string
          track_temp_c: number | null
          wind_direction_deg: number | null
          wind_speed_mps: number | null
        }
        Insert: {
          air_temp_c?: number | null
          humidity_pct?: number | null
          id: string
          pressure_hpa?: number | null
          race_id: string
          rainfall?: boolean | null
          sample_order: number
          sample_time?: string | null
          session_id: string
          source_label?: string
          track_temp_c?: number | null
          wind_direction_deg?: number | null
          wind_speed_mps?: number | null
        }
        Update: {
          air_temp_c?: number | null
          humidity_pct?: number | null
          id?: string
          pressure_hpa?: number | null
          race_id?: string
          rainfall?: boolean | null
          sample_order?: number
          sample_time?: string | null
          session_id?: string
          source_label?: string
          track_temp_c?: number | null
          wind_direction_deg?: number | null
          wind_speed_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_weather_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_weather_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_year_over_year_deltas: {
        Row: {
          circuit_id: string
          comparison_race_id: string
          comparison_season: number
          constructor_id: string | null
          current_gap_s: number
          delta_gap_s: number
          driver_id: string
          id: string
          prior_gap_s: number
          race_id: string
          round: number
          season: number
          session_code: string
          source_label: string
        }
        Insert: {
          circuit_id: string
          comparison_race_id: string
          comparison_season: number
          constructor_id?: string | null
          current_gap_s: number
          delta_gap_s: number
          driver_id: string
          id: string
          prior_gap_s: number
          race_id: string
          round: number
          season: number
          session_code: string
          source_label?: string
        }
        Update: {
          circuit_id?: string
          comparison_race_id?: string
          comparison_season?: number
          constructor_id?: string | null
          current_gap_s?: number
          delta_gap_s?: number
          driver_id?: string
          id?: string
          prior_gap_s?: number
          race_id?: string
          round?: number
          season?: number
          session_code?: string
          source_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_year_over_year_deltas_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_year_over_year_deltas_comparison_race_id_fkey"
            columns: ["comparison_race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_year_over_year_deltas_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_year_over_year_deltas_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_year_over_year_deltas_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          event_name: string | null
          id: string
          race_id: string
          round: number
          scheduled_at: string | null
          season: number
          session_code: string
          session_name: string | null
          source_label: string
        }
        Insert: {
          event_name?: string | null
          id: string
          race_id: string
          round: number
          scheduled_at?: string | null
          season: number
          session_code: string
          session_name?: string | null
          source_label?: string
        }
        Update: {
          event_name?: string | null
          id?: string
          race_id?: string
          round?: number
          scheduled_at?: string | null
          season?: number
          session_code?: string
          session_name?: string | null
          source_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      spain_qualifying_prediction: {
        Row: {
          base_pole_s: number
          baseline_method: string | null
          blend_constructor_delta_weight: number | null
          blend_constructor_weight: number | null
          blend_driver_delta_weight: number | null
          blend_race_week_weight: number | null
          blend_recent_weight: number | null
          blend_same_circuit_weight: number | null
          blend_track_fit_weight: number | null
          clamped_prediction: boolean
          confidence_score: number | null
          constructor_gap_delta_s: number | null
          constructor_id: string | null
          constructor_quali_gap_s: number | null
          driver_gap_delta_s: number | null
          driver_id: string
          form_bias_score: number | null
          id: string
          included_sessions: string | null
          missing_flags: string | null
          mode_label: string
          mode_status: string
          predicted_q_gap_s: number
          predicted_q_rank: number
          predicted_q_time_s: number
          prediction_mode: string
          quality_note: string | null
          race_id: string
          race_week_delta_gap_s: number | null
          recent_quali_gap_s: number | null
          round: number
          same_circuit_gap_s: number | null
          season: number
          season_delta_26_vs_25_s: number | null
          source_label: string
          source_usefulness_rank: number | null
          source_usefulness_score: number | null
          track_fit_gap_s: number | null
          track_residual_s: number | null
        }
        Insert: {
          base_pole_s: number
          baseline_method?: string | null
          blend_constructor_delta_weight?: number | null
          blend_constructor_weight?: number | null
          blend_driver_delta_weight?: number | null
          blend_race_week_weight?: number | null
          blend_recent_weight?: number | null
          blend_same_circuit_weight?: number | null
          blend_track_fit_weight?: number | null
          clamped_prediction?: boolean
          confidence_score?: number | null
          constructor_gap_delta_s?: number | null
          constructor_id?: string | null
          constructor_quali_gap_s?: number | null
          driver_gap_delta_s?: number | null
          driver_id: string
          form_bias_score?: number | null
          id: string
          included_sessions?: string | null
          missing_flags?: string | null
          mode_label?: string
          mode_status?: string
          predicted_q_gap_s: number
          predicted_q_rank: number
          predicted_q_time_s: number
          prediction_mode?: string
          quality_note?: string | null
          race_id: string
          race_week_delta_gap_s?: number | null
          recent_quali_gap_s?: number | null
          round: number
          same_circuit_gap_s?: number | null
          season: number
          season_delta_26_vs_25_s?: number | null
          source_label?: string
          source_usefulness_rank?: number | null
          source_usefulness_score?: number | null
          track_fit_gap_s?: number | null
          track_residual_s?: number | null
        }
        Update: {
          base_pole_s?: number
          baseline_method?: string | null
          blend_constructor_delta_weight?: number | null
          blend_constructor_weight?: number | null
          blend_driver_delta_weight?: number | null
          blend_race_week_weight?: number | null
          blend_recent_weight?: number | null
          blend_same_circuit_weight?: number | null
          blend_track_fit_weight?: number | null
          clamped_prediction?: boolean
          confidence_score?: number | null
          constructor_gap_delta_s?: number | null
          constructor_id?: string | null
          constructor_quali_gap_s?: number | null
          driver_gap_delta_s?: number | null
          driver_id?: string
          form_bias_score?: number | null
          id?: string
          included_sessions?: string | null
          missing_flags?: string | null
          mode_label?: string
          mode_status?: string
          predicted_q_gap_s?: number
          predicted_q_rank?: number
          predicted_q_time_s?: number
          prediction_mode?: string
          quality_note?: string | null
          race_id?: string
          race_week_delta_gap_s?: number | null
          recent_quali_gap_s?: number | null
          round?: number
          same_circuit_gap_s?: number | null
          season?: number
          season_delta_26_vs_25_s?: number | null
          source_label?: string
          source_usefulness_rank?: number | null
          source_usefulness_score?: number | null
          track_fit_gap_s?: number | null
          track_residual_s?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spain_qualifying_prediction_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spain_qualifying_prediction_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spain_qualifying_prediction_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_results: {
        Row: {
          constructor_id: string
          driver_id: string
          finish_position: number | null
          finish_status: string | null
          grid_position: number | null
          id: string
          laps_completed: number | null
          points: number
          race_id: string
        }
        Insert: {
          constructor_id: string
          driver_id: string
          finish_position?: number | null
          finish_status?: string | null
          grid_position?: number | null
          id: string
          laps_completed?: number | null
          points?: number
          race_id: string
        }
        Update: {
          constructor_id?: string
          driver_id?: string
          finish_position?: number | null
          finish_status?: string | null
          grid_position?: number | null
          id?: string
          laps_completed?: number | null
          points?: number
          race_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_results_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_results_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_results_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      standings_context_snapshot: {
        Row: {
          constructor_id: string | null
          entity_id: string
          entity_type: string
          id: string
          points: number | null
          race_id: string
          round: number
          season: number
          source_label: string
          source_race_id: string | null
          standing_position: number | null
          wins: number | null
        }
        Insert: {
          constructor_id?: string | null
          entity_id: string
          entity_type: string
          id: string
          points?: number | null
          race_id: string
          round: number
          season: number
          source_label?: string
          source_race_id?: string | null
          standing_position?: number | null
          wins?: number | null
        }
        Update: {
          constructor_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          points?: number | null
          race_id?: string
          round?: number
          season?: number
          source_label?: string
          source_race_id?: string | null
          standing_position?: number | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "standings_context_snapshot_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_context_snapshot_source_race_id_fkey"
            columns: ["source_race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      stint_degradation_summary: {
        Row: {
          avg_degradation_per_lap_s: number | null
          avg_lap_count: number | null
          avg_tyre_life: number | null
          compound: string | null
          constructor_id: string | null
          degradation_risk: number | null
          driver_id: string | null
          id: string
          race_id: string
          round: number
          season: number
          session_code: string
          source_label: string
        }
        Insert: {
          avg_degradation_per_lap_s?: number | null
          avg_lap_count?: number | null
          avg_tyre_life?: number | null
          compound?: string | null
          constructor_id?: string | null
          degradation_risk?: number | null
          driver_id?: string | null
          id: string
          race_id: string
          round: number
          season: number
          session_code: string
          source_label?: string
        }
        Update: {
          avg_degradation_per_lap_s?: number | null
          avg_lap_count?: number | null
          avg_tyre_life?: number | null
          compound?: string | null
          constructor_id?: string | null
          degradation_risk?: number | null
          driver_id?: string | null
          id?: string
          race_id?: string
          round?: number
          season?: number
          session_code?: string
          source_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "stint_degradation_summary_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stint_degradation_summary_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stint_degradation_summary_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_baselines: {
        Row: {
          constructor_id: string
          degradation_risk: number | null
          driver_id: string
          id: string
          pit_window_end_lap: number | null
          pit_window_start_lap: number | null
          preferred_primary_compound: string | null
          preferred_secondary_compound: string | null
          race_id: string
          rationale: string | null
          recommended_stop_count: number
          round: number
          season: number
          source_label: string
          strategy_confidence: number | null
          tyre_life_index: number | null
        }
        Insert: {
          constructor_id: string
          degradation_risk?: number | null
          driver_id: string
          id: string
          pit_window_end_lap?: number | null
          pit_window_start_lap?: number | null
          preferred_primary_compound?: string | null
          preferred_secondary_compound?: string | null
          race_id: string
          rationale?: string | null
          recommended_stop_count: number
          round: number
          season: number
          source_label: string
          strategy_confidence?: number | null
          tyre_life_index?: number | null
        }
        Update: {
          constructor_id?: string
          degradation_risk?: number | null
          driver_id?: string
          id?: string
          pit_window_end_lap?: number | null
          pit_window_start_lap?: number | null
          preferred_primary_compound?: string | null
          preferred_secondary_compound?: string | null
          race_id?: string
          rationale?: string | null
          recommended_stop_count?: number
          round?: number
          season?: number
          source_label?: string
          strategy_confidence?: number | null
          tyre_life_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_baselines_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_baselines_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_baselines_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_comparison: {
        Row: {
          average_stint_degradation_s: number | null
          compound_sequence: string
          confidence_score: number | null
          constructor_id: string
          delta_vs_baseline_s: number | null
          driver_id: string
          estimated_finish_band_high: number | null
          estimated_finish_band_low: number | null
          estimated_finish_position: number | null
          id: string
          pit_stop_count: number
          race_id: string
          rationale: string | null
          recommendation_rank: number | null
          round: number
          scenario_code: string
          scenario_label: string
          season: number
          source_label: string
          total_race_time_s: number | null
        }
        Insert: {
          average_stint_degradation_s?: number | null
          compound_sequence: string
          confidence_score?: number | null
          constructor_id: string
          delta_vs_baseline_s?: number | null
          driver_id: string
          estimated_finish_band_high?: number | null
          estimated_finish_band_low?: number | null
          estimated_finish_position?: number | null
          id: string
          pit_stop_count: number
          race_id: string
          rationale?: string | null
          recommendation_rank?: number | null
          round: number
          scenario_code: string
          scenario_label: string
          season: number
          source_label?: string
          total_race_time_s?: number | null
        }
        Update: {
          average_stint_degradation_s?: number | null
          compound_sequence?: string
          confidence_score?: number | null
          constructor_id?: string
          delta_vs_baseline_s?: number | null
          driver_id?: string
          estimated_finish_band_high?: number | null
          estimated_finish_band_low?: number | null
          estimated_finish_position?: number | null
          id?: string
          pit_stop_count?: number
          race_id?: string
          rationale?: string | null
          recommendation_rank?: number | null
          round?: number
          scenario_code?: string
          scenario_label?: string
          season?: number
          source_label?: string
          total_race_time_s?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_comparison_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_comparison_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_comparison_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_features: {
        Row: {
          base_quali_pace_s: number | null
          base_race_pace_s: number | null
          baseline_pit_window_end_lap: number | null
          baseline_pit_window_start_lap: number | null
          baseline_stop_count: number | null
          baseline_strategy_code: string | null
          compound_delta_hard_s: number | null
          compound_delta_medium_s: number | null
          compound_delta_soft_s: number | null
          constructor_id: string
          degradation_hard_s_per_lap: number | null
          degradation_medium_s_per_lap: number | null
          degradation_soft_s_per_lap: number | null
          driver_id: string
          id: string
          nominal_race_laps: number
          pace_evolution_s_per_lap: number | null
          pit_loss_s: number | null
          race_id: string
          round: number
          season: number
          source_label: string
          stint_length_hard_laps: number | null
          stint_length_medium_laps: number | null
          stint_length_soft_laps: number | null
        }
        Insert: {
          base_quali_pace_s?: number | null
          base_race_pace_s?: number | null
          baseline_pit_window_end_lap?: number | null
          baseline_pit_window_start_lap?: number | null
          baseline_stop_count?: number | null
          baseline_strategy_code?: string | null
          compound_delta_hard_s?: number | null
          compound_delta_medium_s?: number | null
          compound_delta_soft_s?: number | null
          constructor_id: string
          degradation_hard_s_per_lap?: number | null
          degradation_medium_s_per_lap?: number | null
          degradation_soft_s_per_lap?: number | null
          driver_id: string
          id: string
          nominal_race_laps: number
          pace_evolution_s_per_lap?: number | null
          pit_loss_s?: number | null
          race_id: string
          round: number
          season: number
          source_label?: string
          stint_length_hard_laps?: number | null
          stint_length_medium_laps?: number | null
          stint_length_soft_laps?: number | null
        }
        Update: {
          base_quali_pace_s?: number | null
          base_race_pace_s?: number | null
          baseline_pit_window_end_lap?: number | null
          baseline_pit_window_start_lap?: number | null
          baseline_stop_count?: number | null
          baseline_strategy_code?: string | null
          compound_delta_hard_s?: number | null
          compound_delta_medium_s?: number | null
          compound_delta_soft_s?: number | null
          constructor_id?: string
          degradation_hard_s_per_lap?: number | null
          degradation_medium_s_per_lap?: number | null
          degradation_soft_s_per_lap?: number | null
          driver_id?: string
          id?: string
          nominal_race_laps?: number
          pace_evolution_s_per_lap?: number | null
          pit_loss_s?: number | null
          race_id?: string
          round?: number
          season?: number
          source_label?: string
          stint_length_hard_laps?: number | null
          stint_length_medium_laps?: number | null
          stint_length_soft_laps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_features_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_features_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_features_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_lab_overview: {
        Row: {
          archetype_label: string | null
          best_strategy_code: string | null
          best_strategy_label: string | null
          build_version: string | null
          circuit_id: string
          confidence_score: number | null
          feature_build_version: string | null
          generated_at: string | null
          id: string
          key_insight: string | null
          model_version: string | null
          nominal_race_laps: number | null
          pit_loss_estimate_s: number | null
          race_difficulty: string | null
          race_id: string
          race_name: string
          round: number
          scenario_template_version: string | null
          season: number
          source_label: string
        }
        Insert: {
          archetype_label?: string | null
          best_strategy_code?: string | null
          best_strategy_label?: string | null
          build_version?: string | null
          circuit_id: string
          confidence_score?: number | null
          feature_build_version?: string | null
          generated_at?: string | null
          id: string
          key_insight?: string | null
          model_version?: string | null
          nominal_race_laps?: number | null
          pit_loss_estimate_s?: number | null
          race_difficulty?: string | null
          race_id: string
          race_name: string
          round: number
          scenario_template_version?: string | null
          season: number
          source_label?: string
        }
        Update: {
          archetype_label?: string | null
          best_strategy_code?: string | null
          best_strategy_label?: string | null
          build_version?: string | null
          circuit_id?: string
          confidence_score?: number | null
          feature_build_version?: string | null
          generated_at?: string | null
          id?: string
          key_insight?: string | null
          model_version?: string | null
          nominal_race_laps?: number | null
          pit_loss_estimate_s?: number | null
          race_difficulty?: string | null
          race_id?: string
          race_name?: string
          round?: number
          scenario_template_version?: string | null
          season?: number
          source_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_lab_overview_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_lab_overview_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_profiles: {
        Row: {
          driver_id: string
          expected_pit_stops: number | null
          id: string
          overtake_score: number | null
          race_id: string
          reliability_score: number | null
          safety_car_gain_score: number | null
          tire_management_score: number | null
          wet_weather_score: number | null
        }
        Insert: {
          driver_id: string
          expected_pit_stops?: number | null
          id: string
          overtake_score?: number | null
          race_id: string
          reliability_score?: number | null
          safety_car_gain_score?: number | null
          tire_management_score?: number | null
          wet_weather_score?: number | null
        }
        Update: {
          driver_id?: string
          expected_pit_stops?: number | null
          id?: string
          overtake_score?: number | null
          race_id?: string
          reliability_score?: number | null
          safety_car_gain_score?: number | null
          tire_management_score?: number | null
          wet_weather_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_profiles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_profiles_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_type: string
          created_at: string
          favorite_constructor_id: string | null
          favorite_driver_id: string | null
          onboarding_completed: boolean
          profile_last_changed_at: string | null
          profile_locked_until: string | null
          updated_at: string
          user_id: string
          username: string
          username_is_custom: boolean
          username_last_changed_at: string | null
          username_locked_until: string | null
        }
        Insert: {
          avatar_type?: string
          created_at?: string
          favorite_constructor_id?: string | null
          favorite_driver_id?: string | null
          onboarding_completed?: boolean
          profile_last_changed_at?: string | null
          profile_locked_until?: string | null
          updated_at?: string
          user_id: string
          username: string
          username_is_custom?: boolean
          username_last_changed_at?: string | null
          username_locked_until?: string | null
        }
        Update: {
          avatar_type?: string
          created_at?: string
          favorite_constructor_id?: string | null
          favorite_driver_id?: string | null
          onboarding_completed?: boolean
          profile_last_changed_at?: string | null
          profile_locked_until?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          username_is_custom?: boolean
          username_last_changed_at?: string | null
          username_locked_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_favorite_constructor_id_fkey"
            columns: ["favorite_constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_favorite_driver_id_fkey"
            columns: ["favorite_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_race_picks: {
        Row: {
          fastest_lap_driver_id: string
          fastest_pit_stop_driver_id: string
          id: string
          qualifying_p1_driver_id: string
          qualifying_p2_driver_id: string
          qualifying_p3_driver_id: string
          race_id: string
          race_p1_driver_id: string
          race_p2_driver_id: string
          race_p3_driver_id: string
          random_position_1_driver_id: string
          random_position_2_driver_id: string
          random_position_3_driver_id: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          fastest_lap_driver_id: string
          fastest_pit_stop_driver_id: string
          id: string
          qualifying_p1_driver_id: string
          qualifying_p2_driver_id: string
          qualifying_p3_driver_id: string
          race_id: string
          race_p1_driver_id: string
          race_p2_driver_id: string
          race_p3_driver_id: string
          random_position_1_driver_id: string
          random_position_2_driver_id: string
          random_position_3_driver_id: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          fastest_lap_driver_id?: string
          fastest_pit_stop_driver_id?: string
          id?: string
          qualifying_p1_driver_id?: string
          qualifying_p2_driver_id?: string
          qualifying_p3_driver_id?: string
          race_id?: string
          race_p1_driver_id?: string
          race_p2_driver_id?: string
          race_p3_driver_id?: string
          random_position_1_driver_id?: string
          random_position_2_driver_id?: string
          random_position_3_driver_id?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_race_picks_fastest_lap_driver_id_fkey"
            columns: ["fastest_lap_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_fastest_pit_stop_driver_id_fkey"
            columns: ["fastest_pit_stop_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_qualifying_p1_driver_id_fkey"
            columns: ["qualifying_p1_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_qualifying_p2_driver_id_fkey"
            columns: ["qualifying_p2_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_qualifying_p3_driver_id_fkey"
            columns: ["qualifying_p3_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_race_p1_driver_id_fkey"
            columns: ["race_p1_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_race_p2_driver_id_fkey"
            columns: ["race_p2_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_race_p3_driver_id_fkey"
            columns: ["race_p3_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_random_position_1_driver_id_fkey"
            columns: ["random_position_1_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_random_position_2_driver_id_fkey"
            columns: ["random_position_2_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_race_picks_random_position_3_driver_id_fkey"
            columns: ["random_position_3_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_risk_summary: {
        Row: {
          id: string
          race_id: string
          rainfall_probability: number | null
          round: number
          season: number
          source_label: string
          track_temp_mean_c: number | null
          track_temp_volatility_c: number | null
          weather_risk_index: number | null
          wind_speed_mean_mps: number | null
        }
        Insert: {
          id: string
          race_id: string
          rainfall_probability?: number | null
          round: number
          season: number
          source_label?: string
          track_temp_mean_c?: number | null
          track_temp_volatility_c?: number | null
          weather_risk_index?: number | null
          wind_speed_mean_mps?: number | null
        }
        Update: {
          id?: string
          race_id?: string
          rainfall_probability?: number | null
          round?: number
          season?: number
          source_label?: string
          track_temp_mean_c?: number | null
          track_temp_volatility_c?: number | null
          weather_risk_index?: number | null
          wind_speed_mean_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_risk_summary_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      weekend_readiness_summary: {
        Row: {
          constructor_id: string
          driver_id: string
          id: string
          race_id: string
          rationale: string | null
          readiness_rank: number | null
          readiness_score: number | null
          round: number
          season: number
          signal_confidence: number | null
          source_label: string
        }
        Insert: {
          constructor_id: string
          driver_id: string
          id: string
          race_id: string
          rationale?: string | null
          readiness_rank?: number | null
          readiness_score?: number | null
          round: number
          season: number
          signal_confidence?: number | null
          source_label?: string
        }
        Update: {
          constructor_id?: string
          driver_id?: string
          id?: string
          race_id?: string
          rationale?: string | null
          readiness_rank?: number | null
          readiness_score?: number | null
          round?: number
          season?: number
          signal_confidence?: number | null
          source_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekend_readiness_summary_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekend_readiness_summary_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekend_readiness_summary_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pit_window_view: {
        Row: {
          compound_in: string | null
          compound_out: string | null
          constructor_id: string | null
          driver_id: string | null
          id: string | null
          race_id: string | null
          round: number | null
          scenario_code: string | null
          season: number | null
          source_label: string | null
          stop_number: number | null
          window_end_lap: number | null
          window_start_lap: number | null
        }
        Insert: {
          compound_in?: string | null
          compound_out?: string | null
          constructor_id?: string | null
          driver_id?: string | null
          id?: string | null
          race_id?: string | null
          round?: number | null
          scenario_code?: string | null
          season?: number | null
          source_label?: string | null
          stop_number?: number | null
          window_end_lap?: number | null
          window_start_lap?: number | null
        }
        Update: {
          compound_in?: string | null
          compound_out?: string | null
          constructor_id?: string | null
          driver_id?: string | null
          id?: string | null
          race_id?: string | null
          round?: number | null
          scenario_code?: string | null
          season?: number | null
          source_label?: string | null
          stop_number?: number | null
          window_end_lap?: number | null
          window_start_lap?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pit_window_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pit_window_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pit_window_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_pick_overall_scores: {
        Row: {
          races_entered: number | null
          total_points: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      race_pick_scores: {
        Row: {
          fastest_lap_points: number | null
          fastest_pit_stop_points: number | null
          qualifying_p1_points: number | null
          qualifying_p2_points: number | null
          qualifying_p3_points: number | null
          race_id: string | null
          race_p1_points: number | null
          race_p2_points: number | null
          race_p3_points: number | null
          random_position_1_points: number | null
          random_position_2_points: number | null
          random_position_3_points: number | null
          round: number | null
          season: number | null
          total_points: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_race_picks_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_projection_view: {
        Row: {
          baseline_strategy_code: string | null
          baseline_total_time_s: number | null
          confidence_score: number | null
          constructor_id: string | null
          driver_id: string | null
          finish_band_high: number | null
          finish_band_low: number | null
          id: string | null
          podium_probability: number | null
          projected_finish: number | null
          race_id: string | null
          round: number | null
          season: number | null
          source_label: string | null
          win_probability: number | null
        }
        Insert: {
          baseline_strategy_code?: string | null
          baseline_total_time_s?: number | null
          confidence_score?: number | null
          constructor_id?: string | null
          driver_id?: string | null
          finish_band_high?: number | null
          finish_band_low?: number | null
          id?: string | null
          podium_probability?: number | null
          projected_finish?: number | null
          race_id?: string | null
          round?: number | null
          season?: number | null
          source_label?: string | null
          win_probability?: number | null
        }
        Update: {
          baseline_strategy_code?: string | null
          baseline_total_time_s?: number | null
          confidence_score?: number | null
          constructor_id?: string | null
          driver_id?: string | null
          finish_band_high?: number | null
          finish_band_low?: number | null
          id?: string | null
          podium_probability?: number | null
          projected_finish?: number | null
          race_id?: string | null
          round?: number | null
          season?: number | null
          source_label?: string | null
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_projection_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_projection_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_projection_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_constructor_board_view: {
        Row: {
          constructor_id: string | null
          constructor_name: string | null
          degradation_index: number | null
          id: string | null
          long_run_pace_s: number | null
          one_lap_pace_s: number | null
          race_id: string | null
          readiness_score: number | null
          round: number | null
          season: number | null
          signal_confidence: number | null
          source_label: string | null
          summary: string | null
        }
        Insert: {
          constructor_id?: string | null
          constructor_name?: string | null
          degradation_index?: number | null
          id?: string | null
          long_run_pace_s?: number | null
          one_lap_pace_s?: number | null
          race_id?: string | null
          readiness_score?: number | null
          round?: number | null
          season?: number | null
          signal_confidence?: number | null
          source_label?: string | null
          summary?: string | null
        }
        Update: {
          constructor_id?: string | null
          constructor_name?: string | null
          degradation_index?: number | null
          id?: string | null
          long_run_pace_s?: number | null
          one_lap_pace_s?: number | null
          race_id?: string | null
          readiness_score?: number | null
          round?: number | null
          season?: number | null
          signal_confidence?: number | null
          source_label?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_constructor_board_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_constructor_board_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_driver_board_view: {
        Row: {
          constructor_id: string | null
          constructor_name: string | null
          degradation_s_per_lap: number | null
          driver_id: string | null
          driver_name: string | null
          gap_to_long_run_best_s: number | null
          gap_to_one_lap_best_s: number | null
          id: string | null
          long_run_pace_s: number | null
          one_lap_pace_s: number | null
          projected_finish: number | null
          race_id: string | null
          readiness_score: number | null
          round: number | null
          season: number | null
          signal_confidence: number | null
          source_label: string | null
          summary: string | null
        }
        Insert: {
          constructor_id?: string | null
          constructor_name?: string | null
          degradation_s_per_lap?: number | null
          driver_id?: string | null
          driver_name?: string | null
          gap_to_long_run_best_s?: number | null
          gap_to_one_lap_best_s?: number | null
          id?: string | null
          long_run_pace_s?: number | null
          one_lap_pace_s?: number | null
          projected_finish?: number | null
          race_id?: string | null
          readiness_score?: number | null
          round?: number | null
          season?: number | null
          signal_confidence?: number | null
          source_label?: string | null
          summary?: string | null
        }
        Update: {
          constructor_id?: string | null
          constructor_name?: string | null
          degradation_s_per_lap?: number | null
          driver_id?: string | null
          driver_name?: string | null
          gap_to_long_run_best_s?: number | null
          gap_to_one_lap_best_s?: number | null
          id?: string | null
          long_run_pace_s?: number | null
          one_lap_pace_s?: number | null
          projected_finish?: number | null
          race_id?: string | null
          readiness_score?: number | null
          round?: number | null
          season?: number | null
          signal_confidence?: number | null
          source_label?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_driver_board_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_driver_board_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_driver_board_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_overview_view: {
        Row: {
          archetype_label: string | null
          build_version: string | null
          circuit_id: string | null
          circuit_name: string | null
          generated_at: string | null
          id: string | null
          latest_completed_race_id: string | null
          race_id: string | null
          race_name: string | null
          round: number | null
          scheduled_at: string | null
          season: number | null
          signal_confidence: number | null
          source_label: string | null
          sprint_weekend: boolean | null
          status: string | null
          strategy_difficulty: string | null
          weather_risk_index: number | null
        }
        Insert: {
          archetype_label?: string | null
          build_version?: string | null
          circuit_id?: string | null
          circuit_name?: string | null
          generated_at?: string | null
          id?: string | null
          latest_completed_race_id?: string | null
          race_id?: string | null
          race_name?: string | null
          round?: number | null
          scheduled_at?: string | null
          season?: number | null
          signal_confidence?: number | null
          source_label?: string | null
          sprint_weekend?: boolean | null
          status?: string | null
          strategy_difficulty?: string | null
          weather_risk_index?: number | null
        }
        Update: {
          archetype_label?: string | null
          build_version?: string | null
          circuit_id?: string | null
          circuit_name?: string | null
          generated_at?: string | null
          id?: string | null
          latest_completed_race_id?: string | null
          race_id?: string | null
          race_name?: string | null
          round?: number | null
          scheduled_at?: string | null
          season?: number | null
          signal_confidence?: number | null
          source_label?: string | null
          sprint_weekend?: boolean | null
          status?: string | null
          strategy_difficulty?: string | null
          weather_risk_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_overview_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_overview_latest_completed_race_id_fkey"
            columns: ["latest_completed_race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_overview_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_storylines_view: {
        Row: {
          body: string | null
          confidence_band: string | null
          entity_id: string | null
          entity_type: string | null
          headline: string | null
          id: string | null
          priority_rank: number | null
          published_at: string | null
          race_id: string | null
          round: number | null
          season: number | null
          signal_confidence: number | null
          source_label: string | null
          source_title: string | null
          source_url: string | null
          storyline_type: string | null
        }
        Insert: {
          body?: string | null
          confidence_band?: string | null
          entity_id?: string | null
          entity_type?: string | null
          headline?: string | null
          id?: string | null
          priority_rank?: number | null
          published_at?: string | null
          race_id?: string | null
          round?: number | null
          season?: number | null
          signal_confidence?: number | null
          source_label?: string | null
          source_title?: string | null
          source_url?: string | null
          storyline_type?: string | null
        }
        Update: {
          body?: string | null
          confidence_band?: string | null
          entity_id?: string | null
          entity_type?: string | null
          headline?: string | null
          id?: string | null
          priority_rank?: number | null
          published_at?: string | null
          race_id?: string | null
          round?: number | null
          season?: number | null
          signal_confidence?: number | null
          source_label?: string | null
          source_title?: string | null
          source_url?: string | null
          storyline_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_storylines_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_week_strategy_view: {
        Row: {
          constructor_id: string | null
          degradation_risk: number | null
          driver_id: string | null
          id: string | null
          pit_window_end_lap: number | null
          pit_window_start_lap: number | null
          preferred_primary_compound: string | null
          preferred_secondary_compound: string | null
          race_id: string | null
          rationale: string | null
          recommended_stop_count: number | null
          round: number | null
          season: number | null
          source_label: string | null
          strategy_confidence: number | null
        }
        Insert: {
          constructor_id?: string | null
          degradation_risk?: number | null
          driver_id?: string | null
          id?: string | null
          pit_window_end_lap?: number | null
          pit_window_start_lap?: number | null
          preferred_primary_compound?: string | null
          preferred_secondary_compound?: string | null
          race_id?: string | null
          rationale?: string | null
          recommended_stop_count?: number | null
          round?: number | null
          season?: number | null
          source_label?: string | null
          strategy_confidence?: number | null
        }
        Update: {
          constructor_id?: string | null
          degradation_risk?: number | null
          driver_id?: string | null
          id?: string | null
          pit_window_end_lap?: number | null
          pit_window_start_lap?: number | null
          preferred_primary_compound?: string | null
          preferred_secondary_compound?: string | null
          race_id?: string | null
          rationale?: string | null
          recommended_stop_count?: number | null
          round?: number | null
          season?: number | null
          source_label?: string | null
          strategy_confidence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_week_strategy_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_strategy_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_week_strategy_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_comparison_view: {
        Row: {
          average_stint_degradation_s: number | null
          compound_sequence: string | null
          confidence_score: number | null
          constructor_id: string | null
          delta_vs_baseline_s: number | null
          driver_id: string | null
          estimated_finish_band_high: number | null
          estimated_finish_band_low: number | null
          estimated_finish_position: number | null
          id: string | null
          pit_stop_count: number | null
          race_id: string | null
          rationale: string | null
          recommendation_rank: number | null
          round: number | null
          scenario_code: string | null
          scenario_label: string | null
          season: number | null
          source_label: string | null
          total_race_time_s: number | null
        }
        Insert: {
          average_stint_degradation_s?: number | null
          compound_sequence?: string | null
          confidence_score?: number | null
          constructor_id?: string | null
          delta_vs_baseline_s?: number | null
          driver_id?: string | null
          estimated_finish_band_high?: number | null
          estimated_finish_band_low?: number | null
          estimated_finish_position?: number | null
          id?: string | null
          pit_stop_count?: number | null
          race_id?: string | null
          rationale?: string | null
          recommendation_rank?: number | null
          round?: number | null
          scenario_code?: string | null
          scenario_label?: string | null
          season?: number | null
          source_label?: string | null
          total_race_time_s?: number | null
        }
        Update: {
          average_stint_degradation_s?: number | null
          compound_sequence?: string | null
          confidence_score?: number | null
          constructor_id?: string | null
          delta_vs_baseline_s?: number | null
          driver_id?: string | null
          estimated_finish_band_high?: number | null
          estimated_finish_band_low?: number | null
          estimated_finish_position?: number | null
          id?: string | null
          pit_stop_count?: number | null
          race_id?: string | null
          rationale?: string | null
          recommendation_rank?: number | null
          round?: number | null
          scenario_code?: string | null
          scenario_label?: string | null
          season?: number | null
          source_label?: string | null
          total_race_time_s?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_comparison_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_comparison_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_comparison_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_lab_overview_view: {
        Row: {
          archetype_label: string | null
          best_strategy_code: string | null
          best_strategy_label: string | null
          build_version: string | null
          circuit_id: string | null
          confidence_score: number | null
          feature_build_version: string | null
          generated_at: string | null
          id: string | null
          key_insight: string | null
          model_version: string | null
          nominal_race_laps: number | null
          pit_loss_estimate_s: number | null
          race_difficulty: string | null
          race_id: string | null
          race_name: string | null
          round: number | null
          scenario_template_version: string | null
          season: number | null
          source_label: string | null
        }
        Insert: {
          archetype_label?: string | null
          best_strategy_code?: string | null
          best_strategy_label?: string | null
          build_version?: string | null
          circuit_id?: string | null
          confidence_score?: number | null
          feature_build_version?: string | null
          generated_at?: string | null
          id?: string | null
          key_insight?: string | null
          model_version?: string | null
          nominal_race_laps?: number | null
          pit_loss_estimate_s?: number | null
          race_difficulty?: string | null
          race_id?: string | null
          race_name?: string | null
          round?: number | null
          scenario_template_version?: string | null
          season?: number | null
          source_label?: string | null
        }
        Update: {
          archetype_label?: string | null
          best_strategy_code?: string | null
          best_strategy_label?: string | null
          build_version?: string | null
          circuit_id?: string | null
          confidence_score?: number | null
          feature_build_version?: string | null
          generated_at?: string | null
          id?: string | null
          key_insight?: string | null
          model_version?: string | null
          nominal_race_laps?: number | null
          pit_loss_estimate_s?: number | null
          race_difficulty?: string | null
          race_id?: string | null
          race_name?: string | null
          round?: number | null
          scenario_template_version?: string | null
          season?: number | null
          source_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_lab_overview_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_lab_overview_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      v_driver_lap_trace: {
        Row: {
          circuit: string | null
          compound: string | null
          driver_code: string | null
          field_rank_on_lap: number | null
          fuel_corrected_delta_s: number | null
          lap_number: string | null
          lap_time_s: number | null
          normalized_pace_delta_s: number | null
          race_analysis_id: string | null
          race_name: string | null
          race_phase: string | null
          round: number | null
          season: number | null
          stint_number: string | null
          team: string | null
          tyre_age: string | null
        }
        Relationships: []
      }
      v_driver_season_telemetry: {
        Row: {
          avg_field_rank: number | null
          best_lap_s: number | null
          clean_lap_samples: number | null
          constructor_name: string | null
          deg_s_per_lap: number | null
          driver_code: string | null
          driver_name: string | null
          lap_samples: number | null
          pace_consistency_s: number | null
          points: number | null
          quali_gap_med_s: number | null
          quali_samples: number | null
          race_pace_delta_s: number | null
          season: number | null
          standing_position: number | null
          standings_round: number | null
          stint_samples: number | null
          team: string | null
          wins: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      score_position_pick: {
        Args: {
          actual_position: number
          picked_driver_id: string
          target_position: number
        }
        Returns: number
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
  public: {
    Enums: {},
  },
} as const
