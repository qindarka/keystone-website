<?php
/**
 * Title: Hero (homepage)
 * Slug: keystone/hero
 * Categories: keystone
 * Block Types: core/group
 * Description: Homepage hero with eyebrow, heading, lead, CTA buttons, stats and operations-snapshot card.
 */
?>
<!-- wp:html -->
<section class="hero">
  <div class="container">
    <div class="hero-grid">
      <div>
        <span class="eyebrow"><span class="dot"></span> Trusted MSP in Southwestern Ontario</span>
        <h1>IT that just works — so your business can keep moving.</h1>
        <p>Keystone Technologies delivers reliable, expert IT services to small and medium-sized businesses across Southwestern Ontario. Managed services, cybersecurity, cloud, VoIP and compliance — handled top to bottom.</p>
        <div class="hero-cta">
          <a href="/contact" class="btn btn-primary">Talk to our team</a>
          <a href="/services" class="btn btn-secondary">Explore services</a>
        </div>
        <div class="hero-stats">
          <div class="stat"><strong>24/7</strong><span>Network monitoring</span></div>
          <div class="stat"><strong>30+ yrs</strong><span>Serving local SMBs</span></div>
          <div class="stat"><strong>&lt;15 min</strong><span>Avg. response time</span></div>
        </div>
      </div>
      <aside class="hero-card" aria-hidden="true">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="icon-tile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 4 6v6c0 5 3.5 9.4 8 10 4.5-.6 8-5 8-10V6l-8-4z"/></svg>
            </span>
            <strong style="color:#fff;">Operations Snapshot</strong>
          </div>
          <span style="color: rgba(255,255,255,0.55); font-size:0.78rem;">Live</span>
        </div>
        <div class="status-row">
          <span class="label"><span class="icon-tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg></span> Network uptime</span>
          <span class="value"><span class="pulse"></span> 99.98%</span>
        </div>
        <div class="status-row">
          <span class="label"><span class="icon-tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span> Threats blocked (24h)</span>
          <span class="value" data-counter data-min="1120" data-max="1680" data-tick-min="3500" data-tick-max="11000">1,284</span>
        </div>
        <div class="status-row">
          <span class="label"><span class="icon-tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></span> Backups verified</span>
          <span class="value"><span class="pulse"></span> All systems</span>
        </div>
        <div class="status-row">
          <span class="label"><span class="icon-tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span> Tickets resolved this week</span>
          <span class="value" data-counter data-min="184" data-max="327" data-tick-min="18000" data-tick-max="55000">217</span>
        </div>
        <div style="margin-top:18px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.85rem; color:rgba(255,255,255,0.65);">
          Keystone monitors your environment around the clock — so issues are spotted and solved before they cost you a workday.
        </div>
      </aside>
    </div>
  </div>
</section>
<!-- /wp:html -->
