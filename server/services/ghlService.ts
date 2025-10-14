import type { LeadIntake } from '@shared/schema';

interface GHLContact {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
  website?: string;
  tags?: string[];
  customField?: Record<string, any>;
  source?: string;
}

interface GHLApiResponse {
  contact?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  message?: string;
  statusCode?: number;
}

export class GHLService {
  private apiKey: string;
  private baseUrl = 'https://services.leadconnectorhq.com';

  constructor() {
    this.apiKey = process.env.GHL_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ GHL_API_KEY not configured - GHL integration disabled');
    }
  }

  /**
   * Send lead to Go-High-Level CRM (creates contact and opportunity)
   */
  async sendLeadToGHL(leadIntake: LeadIntake): Promise<{ success: boolean; ghlContactId?: string; ghlOpportunityId?: string; error?: string }> {
    if (!this.apiKey) {
      console.log('🔄 GHL integration skipped - API key not configured');
      return { success: false, error: 'GHL API key not configured' };
    }

    try {
      // Step 1: Create or update contact
      const contact: GHLContact = this.mapLeadToGHLContact(leadIntake);
      
      console.log(`📤 Sending lead to GHL: ${contact.email}`);
      
      const contactResponse = await fetch(`${this.baseUrl}/contacts/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify(contact),
      });

      const contactData: GHLApiResponse = await contactResponse.json();

      if (!contactResponse.ok || !contactData.contact?.id) {
        console.error('❌ GHL Contact Creation Error:', {
          status: contactResponse.status,
          statusText: contactResponse.statusText,
          message: contactData.message,
          contactData
        });
        return { 
          success: false, 
          error: `GHL Contact API Error: ${contactData.message || contactResponse.statusText}` 
        };
      }

      const contactId = contactData.contact.id;
      console.log(`✅ Contact created in GHL: Contact ID ${contactId}`);

      // Step 2: Create opportunity
      const opportunityData = this.createOpportunityData(leadIntake, contactId);
      
      const opportunityResponse = await fetch(`${this.baseUrl}/opportunities/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify(opportunityData),
      });

      const oppData = await opportunityResponse.json();

      if (opportunityResponse.ok && oppData.id) {
        console.log(`✅ Opportunity created in GHL: Opportunity ID ${oppData.id}`);
        return { 
          success: true, 
          ghlContactId: contactId,
          ghlOpportunityId: oppData.id
        };
      } else {
        console.warn('⚠️ GHL Opportunity Creation Warning:', {
          status: opportunityResponse.status,
          message: oppData.message,
          oppData
        });
        // Contact was created successfully, so still return success
        return { 
          success: true, 
          ghlContactId: contactId,
          error: `Contact created but opportunity failed: ${oppData.message || opportunityResponse.statusText}`
        };
      }
    } catch (error: any) {
      console.error('❌ GHL Service Error:', error);
      return { 
        success: false, 
        error: `GHL Service Error: ${error.message}` 
      };
    }
  }

  /**
   * Map OnSpot lead intake data to GHL contact format
   */
  private mapLeadToGHLContact(leadIntake: LeadIntake): GHLContact {
    // Generate relevant tags based on lead data
    const tags = this.generateTags(leadIntake);

    // Map service type to more descriptive format
    const serviceTypeMap: Record<string, string> = {
      'customer_support': 'Customer Support',
      'virtual_assistants': 'Virtual Assistant',
      'technical_support': 'Technical Support',
      'back_office': 'Back Office',
      'sales_marketing': 'Sales & Marketing',
      'design_creative': 'Design & Creative'
    };

    return {
      firstName: leadIntake.firstName,
      lastName: leadIntake.lastName,
      email: leadIntake.email,
      phone: leadIntake.phoneNumber || undefined,
      companyName: leadIntake.companyName,
      website: leadIntake.companyWebsite || undefined,
      tags,
      source: 'OnSpot Website',
      customField: {
        // Company Information
        company_size: leadIntake.companySize,
        industry: leadIntake.industry,
        job_title: leadIntake.jobTitle,
        
        // Service Requirements
        service_type: serviceTypeMap[leadIntake.serviceType] || leadIntake.serviceType,
        service_volume: leadIntake.serviceVolume,
        current_challenges: leadIntake.currentChallenges,
        required_skills: leadIntake.requiredSkills?.join(', '),
        
        // Project Scope
        urgency_level: leadIntake.urgencyLevel,
        budget_range: leadIntake.budgetRange,
        expected_start_date: leadIntake.expectedStartDate,
        team_size: leadIntake.teamSize,
        
        // Qualification
        has_current_provider: leadIntake.hasCurrentProvider,
        current_provider_details: leadIntake.currentProviderDetails,
        decision_maker_status: leadIntake.decisionMakerStatus,
        implementation_timeline: leadIntake.implementationTimeline,
        
        // Lead Scoring
        lead_score: leadIntake.leadScore,
        
        // UTM Tracking
        utm_source: leadIntake.utmSource,
        utm_medium: leadIntake.utmMedium,
        utm_campaign: leadIntake.utmCampaign,
        referring_page: leadIntake.referringPage,
        
        // Additional Notes
        additional_notes: leadIntake.additionalNotes,
      }
    };
  }

  /**
   * Create opportunity data for GHL
   */
  private createOpportunityData(leadIntake: LeadIntake, contactId: string) {
    // Map budget range to monetary value
    const monetaryValueMap: Record<string, number> = {
      '<5k': 3000,
      '5k-20k': 12500,
      '20k-50k': 35000,
      '50k+': 75000
    };

    // Map urgency to pipeline stage
    const stageMap: Record<string, string> = {
      'immediate': 'hot_lead',
      'within_month': 'qualified',
      'within_quarter': 'contacted',
      'planning': 'new'
    };

    const serviceTypeMap: Record<string, string> = {
      'customer_support': 'Customer Support',
      'virtual_assistants': 'Virtual Assistant',
      'technical_support': 'Technical Support',
      'back_office': 'Back Office',
      'sales_marketing': 'Sales & Marketing',
      'design_creative': 'Design & Creative'
    };

    return {
      contactId: contactId,
      name: `${leadIntake.companyName} - ${serviceTypeMap[leadIntake.serviceType] || leadIntake.serviceType}`,
      monetaryValue: monetaryValueMap[leadIntake.budgetRange] || 10000,
      pipelineStage: stageMap[leadIntake.urgencyLevel] || 'new',
      status: 'open',
      source: 'OnSpot Website',
      customFields: {
        service_type: leadIntake.serviceType,
        urgency_level: leadIntake.urgencyLevel,
        budget_range: leadIntake.budgetRange,
        team_size: leadIntake.teamSize,
        expected_start_date: leadIntake.expectedStartDate,
        decision_maker_status: leadIntake.decisionMakerStatus,
        current_challenges: leadIntake.currentChallenges,
        lead_score: leadIntake.leadScore
      }
    };
  }

  /**
   * Generate relevant tags for lead categorization in GHL
   */
  private generateTags(leadIntake: LeadIntake): string[] {
    const tags: string[] = ['OnSpot Lead'];

    // Service type tag
    if (leadIntake.serviceType) {
      const serviceMap: Record<string, string> = {
        'customer_support': 'Customer Support',
        'virtual_assistants': 'Virtual Assistant',
        'technical_support': 'Technical Support',
        'back_office': 'Back Office',
        'sales_marketing': 'Sales & Marketing',
        'design_creative': 'Design & Creative'
      };
      tags.push(serviceMap[leadIntake.serviceType] || leadIntake.serviceType);
    }

    // Urgency tag
    if (leadIntake.urgencyLevel === 'immediate') {
      tags.push('Hot Lead');
    } else if (leadIntake.urgencyLevel === 'within_month') {
      tags.push('Warm Lead');
    } else {
      tags.push('Cold Lead');
    }

    // Budget tier tag
    if (leadIntake.budgetRange) {
      if (leadIntake.budgetRange.includes('50k+')) {
        tags.push('Enterprise Budget');
      } else if (leadIntake.budgetRange.includes('20k-50k')) {
        tags.push('High Budget');
      } else if (leadIntake.budgetRange.includes('5k-20k')) {
        tags.push('Medium Budget');
      } else {
        tags.push('Small Budget');
      }
    }

    // Company size tag
    if (leadIntake.companySize) {
      if (leadIntake.companySize.includes('500+')) {
        tags.push('Enterprise');
      } else if (leadIntake.companySize.includes('51-200') || leadIntake.companySize.includes('201-500')) {
        tags.push('Mid-Market');
      } else {
        tags.push('SMB');
      }
    }

    // Decision maker tag
    if (leadIntake.decisionMakerStatus === 'decision_maker') {
      tags.push('Decision Maker');
    } else if (leadIntake.decisionMakerStatus === 'influencer') {
      tags.push('Influencer');
    }

    // Lead score tier
    const leadScore = leadIntake.leadScore || 0;
    if (leadScore >= 80) {
      tags.push('High Quality Lead');
    } else if (leadScore >= 60) {
      tags.push('Medium Quality Lead');
    } else {
      tags.push('Low Quality Lead');
    }

    return tags;
  }
}

export const ghlService = new GHLService();