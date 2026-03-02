/**
 * Structured Data Components - SEO Optimization
 *
 * Provides JSON-LD structured data for:
 * - SoftwareApplication
 * - Organization
 * - FAQPage
 * - WebSite
 */

// Types inlined — no React types needed at module level

interface JsonLdProps {
  data: Record<string, unknown>;
}

function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Software Application schema
export function SoftwareApplicationSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Requiem',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS, Windows',
    softwareVersion: '0.2.0',
    description: 'Provable AI Runtime — deterministic execution, enforced governance, replayable outcomes',
    url: 'https://requiem.hardonian.com',
    author: {
      '@type': 'Organization',
      name: 'Hardonian',
    },
    featureList: [
      'Deterministic AI execution',
      'Cryptographic execution proofs',
      'Byte-perfect replay',
      'Policy enforcement',
      'LLM provider arbitration',
    ],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '100',
    },
  };

  return <JsonLd data={data} />;
}

// Organization schema
export function OrganizationSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Hardonian',
    url: 'https://hardonian.com',
    logo: 'https://requiem.hardonian.com/logo.png',
    sameAs: [
      'https://github.com/reachhq',
    ],
    description: 'Building deterministic AI infrastructure for enterprise agents',
  };

  return <JsonLd data={data} />;
}

// FAQ Page schema for signing/replay/arbitration explanations
export function FAQPageSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is deterministic AI execution?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Deterministic AI execution ensures that the same input always produces the same output, with cryptographic proof of execution integrity. This enables reproducible AI workflows and verifiable outcomes.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does AI artifact signing work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'AI artifact signing uses BLAKE3 hashing to create unique fingerprints of AI-generated outputs. Each artifact is signed with a cryptographic hash that proves its origin and integrity, enabling verification at any point.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are replayable AI workflows?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Replayable AI workflows capture the complete execution context including inputs, model parameters, and environmental state. This allows exact reproduction of AI executions for audit, debugging, or compliance purposes.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does LLM provider arbitration work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Provider arbitration routes requests across multiple LLM providers based on policy rules, cost optimization, and reliability metrics. It ensures service continuity and enforces governance across provider boundaries.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are policy enforced AI pipelines?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Policy enforced AI pipelines apply deny-by-default governance rules to all AI operations. Every execution passes through policy gates that validate compliance with organizational rules, cost budgets, and safety constraints.',
        },
      },
    ],
  };

  return <JsonLd data={data} />;
}

// WebSite schema with search
export function WebsiteSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Requiem',
    url: 'https://requiem.hardonian.com',
    description: 'Provable AI Runtime for deterministic AI execution',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://requiem.hardonian.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return <JsonLd data={data} />;
}

// BreadcrumbList schema
interface BreadcrumbItem {
  name: string;
  path: string;
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://requiem.hardonian.com${item.path}`,
    })),
  };

  return <JsonLd data={data} />;
}

// Combine all schemas for root layout
export function RootStructuredData() {
  return (
    <>
      <SoftwareApplicationSchema />
      <OrganizationSchema />
      <WebsiteSchema />
    </>
  );
}
