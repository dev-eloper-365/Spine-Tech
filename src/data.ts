// Real client work: one case-study film per project (POW Demos exports v3; web copies in public/work/).
// `tags` = solution and industry, as the films state them. `group` = the film series.
export const groups = {
  S1: 'Digital Experiences',
  S2: 'Business Systems',
  S3: 'Technology',
} as const;

type Project = { id: string; name: string; tags: string[]; group: keyof typeof groups };

const list: Project[] = [
  { id: 'S1-01', name: 'KK Jewels Silver Studio', tags: ['Commerce experience', 'Silver studio'], group: 'S1' },
  { id: 'S1-02', name: 'Almirah Luxe Gallery', tags: ['Scroll-story website', 'Luxury venue'], group: 'S1' },
  { id: 'S1-03', name: 'Maliha Designs', tags: ['Fashion storefront', 'Occasion wear'], group: 'S1' },
  { id: 'S1-04', name: 'Rahul Impex', tags: ['Online storefront', 'Dry fruits retail'], group: 'S1' },
  { id: 'S1-05', name: 'Dev Tours & Travels', tags: ['Tour package site', 'Travel agency'], group: 'S1' },
  { id: 'S1-06', name: 'Onyx Technologies LLC', tags: ['Lead-generation website', 'Payroll and staffing'], group: 'S1' },
  { id: 'S2-01', name: 'Slotly AI', tags: ['Booking platform', 'Service studio'], group: 'S2' },
  { id: 'S2-02', name: 'SLA Monitor', tags: ['SLA dashboard', 'IT operations'], group: 'S2' },
  { id: 'S2-03', name: 'Ultra Doc', tags: ['Document intelligence', 'Freight logistics'], group: 'S2' },
  { id: 'S2-04', name: 'BillSwift', tags: ['Billing & inventory', 'Retail billing'], group: 'S2' },
  { id: 'S2-05', name: 'CareerLens', tags: ['Resume & job tracker', 'Job search'], group: 'S2' },
  { id: 'S3-01', name: 'Card Money', tags: ['Real-time multiplayer app', 'Social gaming'], group: 'S3' },
  { id: 'S3-02', name: 'Page Pulse', tags: ['URL audit API', 'Web tooling'], group: 'S3' },
  { id: 'S3-03', name: 'Extroverts', tags: ['Mobile signup flow', 'Social events'], group: 'S3' },
  { id: 'S3-04', name: 'Slotly AI: Under the Hood', tags: ['Booking platform', 'Engineering'], group: 'S3' },
  { id: 'S3-05', name: 'Ultra Doc: Under the Hood', tags: ['Document intelligence', 'Engineering'], group: 'S3' },
  { id: 'S3-06', name: 'SLA Monitor: Under the Hood', tags: ['SLA dashboard', 'Engineering'], group: 'S3' },
];

export const projects = list.map((p) => ({ ...p, video: `/work/${p.id}.mp4`, img: `/work/${p.id}.jpg` }));
