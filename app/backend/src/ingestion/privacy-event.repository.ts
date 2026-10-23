import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { PrivacyToggledEvent } from "./types/contract-event.types";

export interface KeyRotationEvent {
  eventType: "KeyRotationAnnounced" | "KeyRotationActivated" | "KeyRotationRevoked";
  eventId: string;
  username: string;
  schemaVersion: number;
  contractTimestamp: bigint | number | string;
  txHash: string;
  ledgerSequence: number;
  pagingToken: string;
}

@Injectable()
export class PrivacyEventRepository {
  private readonly logger = new Logger(PrivacyEventRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  async upsertEvent(event: PrivacyToggledEvent): Promise<boolean> {
    const { data, error } = await this.supabase.getClient()
      .from("privacy_events")
      .upsert(
        {
          event_type: event.eventType,
          event_id: event.eventId,
          owner: event.owner,
          enabled: event.enabled,
          schema_version: event.schemaVersion,
          contract_timestamp: Number(event.contractTimestamp),
          tx_hash: event.txHash,
          ledger_sequence: event.ledgerSequence,
          paging_token: event.pagingToken,
        },
        { onConflict: "tx_hash,event_type,owner", ignoreDuplicates: true },
      )
      .select("id");

    if (error) {
      this.logger.error(`Failed to upsert PrivacyToggled for owner ${event.owner}: ${error.message}`);
      throw error;
    }
    return Boolean(data?.length);
  }

  async upsertKeyRotationEvent(event: KeyRotationEvent): Promise<boolean> {
    const { data, error } = await this.supabase.getClient()
      .from("key_rotation_events")
      .upsert(
        {
          event_type: event.eventType,
          event_id: event.eventId,
          username: event.username,
          schema_version: event.schemaVersion,
          contract_timestamp: Number(event.contractTimestamp),
          tx_hash: event.txHash,
          ledger_sequence: event.ledgerSequence,
          paging_token: event.pagingToken,
        },
        { onConflict: "tx_hash,event_type,username", ignoreDuplicates: true },
      )
      .select("id");

    if (error) {
      this.logger.error(
        `Failed to upsert ${event.eventType} for username ${event.username}: ${error.message}`,
      );
      throw error;
    }
    return Boolean(data?.length);
  }
}