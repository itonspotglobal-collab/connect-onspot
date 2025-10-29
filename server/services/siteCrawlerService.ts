import cron from 'node-cron';
import { crawlWebsite } from './siteCrawler';

export class SiteCrawlerService {
  private isConfigured: boolean;

  constructor() {
    // Check if OpenAI API key is configured (required for summarization)
    this.isConfigured = !!process.env.OPENAI_API_KEY;
    
    if (!this.isConfigured) {
      console.warn('⚠️ OPENAI_API_KEY not configured - Site crawler disabled');
    }
  }

  /**
   * Start the automatic crawl cron job (runs daily at 3:00 AM)
   */
  startCronJob() {
    if (!this.isConfigured) {
      console.log('⏭️ Site crawler cron job skipped - OpenAI API key not configured');
      return;
    }

    // Run daily at 3:00 AM: 0 3 * * *
    cron.schedule('0 3 * * *', async () => {
      console.log('🔄 Starting scheduled site crawl...');
      await this.crawlSite();
    });

    console.log('✅ Site crawler cron job started - runs daily at 3:00 AM');
    
    // Optional: Run initial crawl on startup (commented out to avoid slowing down server start)
    // this.crawlSite().catch(err => {
    //   console.error('❌ Initial site crawl failed:', err);
    // });
  }

  /**
   * Crawl the OnSpotGlobal.com website
   */
  async crawlSite() {
    if (!this.isConfigured) {
      console.log('⏭️ Site crawl skipped - OpenAI API key not configured');
      return;
    }

    try {
      console.log('🌐 Starting OnSpotGlobal.com crawl...');
      const siteIndex = await crawlWebsite();
      console.log(
        `🌐 Site crawl completed at ${siteIndex.lastUpdated} — ${siteIndex.totalPages} pages indexed`
      );
    } catch (error: any) {
      console.error('❌ Site crawl failed:', error.message);
    }
  }

  /**
   * Manual trigger for immediate crawl
   */
  async triggerManualCrawl() {
    console.log('🔄 Manual site crawl triggered');
    await this.crawlSite();
  }
}

// Export singleton instance
export const siteCrawlerService = new SiteCrawlerService();
