export type NavLink = { href: string; label: string };

export const marketingNavLinks: NavLink[] = [
  { href: '/features', label: 'Features' },
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Docs' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/support', label: 'Support' },
];

export const marketingFooterGroups: Array<{ title: string; links: NavLink[] }> = [
  {
    title: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/about', label: 'About' },
      { href: '/demo', label: 'Live Demo' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/enterprise', label: 'Enterprise' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/docs', label: 'Documentation' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/status', label: 'System Status' },
      { href: '/support', label: 'Support' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { href: '/security', label: 'Security' },
      { href: '/transparency', label: 'Transparency' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];
