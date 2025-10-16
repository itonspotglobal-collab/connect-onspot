interface GHLBookingContact {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source?: string;
  tags?: string[];
}

interface GHLAppointment {
  calendarId: string;
  contactId: string;
  startTime: string;
  endTime: string;
  title: string;
  appointmentStatus?: string;
  address?: string;
  ignoreDateRange?: boolean;
}

interface BookingRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateTime: string; // ISO format
  message?: string;
  source?: string;
}

interface GHLContactResponse {
  contact?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  message?: string;
}

interface GHLAppointmentResponse {
  id?: string;
  message?: string;
}

export class GHLAppointmentService {
  private apiKey: string;
  private calendarId: string;
  private baseUrl = 'https://services.leadconnectorhq.com';

  constructor() {
    this.apiKey = process.env.GHL_API_KEY || '';
    this.calendarId = process.env.GHL_CALENDAR_ID || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ GHL_API_KEY not configured - Appointment booking disabled');
    }
    if (!this.calendarId) {
      console.warn('⚠️ GHL_CALENDAR_ID not configured - Appointment booking disabled');
    }
  }

  /**
   * Book a call - creates contact and appointment in GHL
   */
  async bookCall(booking: BookingRequest): Promise<{ 
    success: boolean; 
    contactId?: string; 
    appointmentId?: string; 
    error?: string 
  }> {
    if (!this.apiKey) {
      return { 
        success: false, 
        error: 'GHL API key not configured. Please contact support.' 
      };
    }

    if (!this.calendarId) {
      return { 
        success: false, 
        error: 'Calendar not configured. Please contact support.' 
      };
    }

    try {
      // Step 1: Create or update contact
      const contact: GHLBookingContact = {
        firstName: booking.firstName,
        lastName: booking.lastName,
        email: booking.email,
        phone: booking.phone,
        source: booking.source || 'OnSpot Website - Book a Call',
        tags: ['Book a Call', 'Website Booking']
      };

      console.log(`📞 Booking call for: ${contact.email}`);

      const contactResponse = await fetch(`${this.baseUrl}/contacts/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify(contact),
      });

      const contactData: GHLContactResponse = await contactResponse.json();

      if (!contactResponse.ok || !contactData.contact?.id) {
        console.error('❌ GHL Contact Creation Error:', {
          status: contactResponse.status,
          message: contactData.message,
          contactData
        });
        return { 
          success: false, 
          error: `Failed to create contact: ${contactData.message || 'Unknown error'}` 
        };
      }

      const contactId = contactData.contact.id;
      console.log(`✅ Contact created: ${contactId}`);

      // Step 2: Create appointment
      const startTime = new Date(booking.dateTime);
      const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 minutes later

      const appointment: GHLAppointment = {
        calendarId: this.calendarId,
        contactId: contactId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        title: `Discovery Call - ${booking.firstName} ${booking.lastName}`,
        appointmentStatus: 'confirmed',
        ignoreDateRange: true
      };

      console.log(`📅 Creating appointment for ${startTime.toISOString()}`);

      const appointmentResponse = await fetch(`${this.baseUrl}/calendars/events/appointments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify(appointment),
      });

      const appointmentData: GHLAppointmentResponse = await appointmentResponse.json();

      if (!appointmentResponse.ok || !appointmentData.id) {
        console.error('❌ GHL Appointment Creation Error:', {
          status: appointmentResponse.status,
          message: appointmentData.message,
          appointmentData
        });
        
        // Contact was created successfully, but appointment failed
        return { 
          success: false,
          contactId: contactId,
          error: `Contact created but appointment failed: ${appointmentData.message || 'Unknown error'}` 
        };
      }

      const appointmentId = appointmentData.id;
      console.log(`✅ Appointment created: ${appointmentId}`);

      return {
        success: true,
        contactId: contactId,
        appointmentId: appointmentId
      };

    } catch (error: any) {
      console.error('❌ Booking Service Error:', error);
      return { 
        success: false, 
        error: `Booking failed: ${error.message}` 
      };
    }
  }
}

export const ghlAppointmentService = new GHLAppointmentService();
