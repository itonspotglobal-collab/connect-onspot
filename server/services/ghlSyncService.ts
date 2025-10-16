import { db } from '../db';
import { leadIntakes, waitlist } from '@shared/schema';
import { eq } from 'drizzle-orm';
import cron from 'node-cron';

interface GHLSyncResponse {
  success: boolean;
  ghlContactId?: string;
  ghlOpportunityId?: string;
  error?: string;
}

export class GHLSyncService {
  private apiKey: string;
  private baseUrl = 'https://rest.gohighlevel.com/v1';
  private isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.GHL_API_KEY || '';
    this.isConfigured = !!this.apiKey;
    
    if (!this.isConfigured) {
      console.warn('⚠️ GHL_API_KEY not configured - GHL sync disabled');
    }
  }

  /**
   * Start the automatic sync cron job (runs every 15 minutes)
   */
  startCronJob() {
    if (!this.isConfigured) {
      console.log('⏭️ GHL sync cron job skipped - API key not configured');
      return;
    }

    // Run every 15 minutes: */15 * * * *
    cron.schedule('*/15 * * * *', async () => {
      console.log('🔄 Starting scheduled GHL sync...');
      await this.syncAllLeads();
    });

    console.log('✅ GHL sync cron job started - runs every 15 minutes');
    
    // Run initial sync on startup
    this.syncAllLeads().catch(err => {
      console.error('❌ Initial GHL sync failed:', err);
    });
  }

  /**
   * Sync all unsynced leads from both tables
   */
  async syncAllLeads() {
    if (!this.isConfigured) {
      console.log('⏭️ GHL sync skipped - API key not configured');
      return;
    }

    try {
      console.log('📊 Syncing lead_intakes to GHL...');
      await this.syncLeadIntakes();
      
      console.log('📊 Syncing waitlist to GHL...');
      await this.syncWaitlist();
      
      console.log('✅ GHL sync completed successfully');
    } catch (error: any) {
      console.error('❌ GHL sync failed:', error.message);
    }
  }

  /**
   * Sync unsynced lead intakes to GHL
   */
  private async syncLeadIntakes() {
    try {
      // Get all unsynced lead intakes
      const unsyncedLeads = await db
        .select()
        .from(leadIntakes)
        .where(eq(leadIntakes.syncedToGhl, false));

      if (unsyncedLeads.length === 0) {
        console.log('ℹ️ No unsynced lead_intakes found');
        return;
      }

      console.log(`📤 Found ${unsyncedLeads.length} unsynced lead_intakes`);

      for (const lead of unsyncedLeads) {
        try {
          const result = await this.createGHLContactFromLeadIntake(lead);
          
          if (result.success) {
            // Mark as synced
            await db
              .update(leadIntakes)
              .set({
                syncedToGhl: true,
                ghlContactId: result.ghlContactId,
                ghlOpportunityId: result.ghlOpportunityId,
                ghlSyncedAt: new Date(),
              })
              .where(eq(leadIntakes.id, lead.id));

            console.log(`✅ Synced lead_intake: ${lead.email} → GHL Contact ID: ${result.ghlContactId}`);
          } else {
            console.error(`❌ Failed to sync lead_intake ${lead.email}:`, result.error);
          }
        } catch (error: any) {
          console.error(`❌ Error syncing lead_intake ${lead.id}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error('❌ Error in syncLeadIntakes:', error.message);
      throw error;
    }
  }

  /**
   * Sync unsynced waitlist entries to GHL
   */
  private async syncWaitlist() {
    try {
      // Get all unsynced waitlist entries
      const unsyncedEntries = await db
        .select()
        .from(waitlist)
        .where(eq(waitlist.syncedToGhl, false));

      if (unsyncedEntries.length === 0) {
        console.log('ℹ️ No unsynced waitlist entries found');
        return;
      }

      console.log(`📤 Found ${unsyncedEntries.length} unsynced waitlist entries`);

      for (const entry of unsyncedEntries) {
        try {
          const result = await this.createGHLContactFromWaitlist(entry);
          
          if (result.success) {
            // Mark as synced
            await db
              .update(waitlist)
              .set({
                syncedToGhl: true,
                ghlContactId: result.ghlContactId,
                ghlSyncedAt: new Date(),
              })
              .where(eq(waitlist.id, entry.id));

            console.log(`✅ Synced waitlist: ${entry.email} → GHL Contact ID: ${result.ghlContactId}`);
          } else {
            console.error(`❌ Failed to sync waitlist ${entry.email}:`, result.error);
          }
        } catch (error: any) {
          console.error(`❌ Error syncing waitlist ${entry.id}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error('❌ Error in syncWaitlist:', error.message);
      throw error;
    }
  }

  /**
   * Create GHL contact from lead intake
   */
  private async createGHLContactFromLeadIntake(lead: any): Promise<GHLSyncResponse> {
    try {
      const [firstName, ...lastNameParts] = lead.firstName.split(' ');
      const lastName = lead.lastName || lastNameParts.join(' ') || '';

      const contactPayload = {
        firstName: firstName,
        lastName: lastName,
        email: lead.email,
        phone: lead.phoneNumber || undefined,
        source: lead.source || 'Website Intake Form',
        tags: ['Website Lead', 'Lead Intake'],
        companyName: lead.companyName,
        customField: {
          company_size: lead.companySize,
          industry: lead.industry,
          service_type: lead.serviceType,
          urgency_level: lead.urgencyLevel,
          budget_range: lead.budgetRange,
        },
      };

      const response = await fetch(`${this.baseUrl}/contacts/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        ghlContactId: data.contact?.id || data.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create GHL contact from waitlist entry
   */
  private async createGHLContactFromWaitlist(entry: any): Promise<GHLSyncResponse> {
    try {
      const nameParts = entry.fullName.split(' ');
      const firstName = nameParts[0] || entry.fullName;
      const lastName = nameParts.slice(1).join(' ') || '';

      const contactPayload = {
        firstName: firstName,
        lastName: lastName,
        email: entry.email,
        phone: entry.phone || undefined,
        source: 'Waitlist Signup',
        tags: ['Waitlist Lead'],
        companyName: entry.businessName || undefined,
      };

      const response = await fetch(`${this.baseUrl}/contacts/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        ghlContactId: data.contact?.id || data.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Manual trigger for immediate sync
   */
  async triggerManualSync() {
    console.log('🔄 Manual GHL sync triggered');
    await this.syncAllLeads();
  }
}

// Export singleton instance
export const ghlSyncService = new GHLSyncService();
