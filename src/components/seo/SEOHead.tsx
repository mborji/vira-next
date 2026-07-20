import { useEffect } from 'react';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
  schema?: any;
}

interface OrganizationSchema {
  "@context": "https://schema.org";
  "@type": "Organization";
  name: string;
  url: string;
  logo: string;
  description: string;
  contactPoint: {
    "@type": "ContactPoint";
    telephone: string;
    contactType: "customer service";
    areaServed: "IR";
    availableLanguage: "Persian";
  };
  sameAs: string[];
  address: {
    "@type": "PostalAddress";
    addressCountry: "IR";
  };
}

const defaultSEO: SEOProps = {
  title: 'ویراپ - راهکارهای نرم‌افزاری پیشرفته',
  description: 'شرکت پیشرو در توسعه نرم‌افزار، هوش تجاری و تحلیل داده با تیمی از متخصصان مجرب برای تحویل بهترین راه‌حل‌های تکنولوژیکی',
  keywords: 'توسعه نرم افزار، هوش تجاری، تحلیل داده، هوش مصنوعی، DevOps، مشاوره IT، React، Power BI، داشبورد، ویراپ',
  image: '/AboutUsTeam.jpg',
  url: 'https://virap.ir',
  type: 'website'
};

const organizationSchema: OrganizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ویراپ",
  url: "https://virap.ir",
  logo: "/favicon.ico",
  description: "شرکت پیشرو در توسعه نرم‌افزار، هوش تجاری و تحلیل داده",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+98-21-12345678",
    contactType: "customer service",
    areaServed: "IR",
    availableLanguage: "Persian"
  },
  sameAs: [
    "https://linkedin.com/company/virap",
    "https://twitter.com/virap_ir"
  ],
  address: {
    "@type": "PostalAddress",
    addressCountry: "IR"
  }
};

export const SEOHead: React.FC<SEOProps> = (props) => {
  const seo = { ...defaultSEO, ...props };
  const fullTitle = seo.title === defaultSEO.title ? seo.title : `${seo.title} | ویراپ`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Update or create meta tags
    const updateMetaTag = (property: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${property}"]` : `meta[name="${property}"]`;
      let element = document.querySelector(selector) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement('meta');
        if (isProperty) {
          element.setAttribute('property', property);
        } else {
          element.setAttribute('name', property);
        }
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Basic meta tags
    updateMetaTag('description', seo.description!);
    updateMetaTag('keywords', seo.keywords!);
    if (seo.author) {
      updateMetaTag('author', seo.author);
    }

    // Open Graph tags
    updateMetaTag('og:title', fullTitle, true);
    updateMetaTag('og:description', seo.description!, true);
    updateMetaTag('og:type', seo.type!, true);
    updateMetaTag('og:url', seo.url!, true);
    updateMetaTag('og:image', seo.image!, true);
    updateMetaTag('og:site_name', 'ویراپ', true);
    updateMetaTag('og:locale', 'fa_IR', true);

    // Article specific tags
    if (seo.type === 'article') {
      if (seo.publishedTime) {
        updateMetaTag('article:published_time', seo.publishedTime, true);
      }
      if (seo.modifiedTime) {
        updateMetaTag('article:modified_time', seo.modifiedTime, true);
      }
      if (seo.author) {
        updateMetaTag('article:author', seo.author, true);
      }
      if (seo.section) {
        updateMetaTag('article:section', seo.section, true);
      }
      if (seo.tags) {
        seo.tags.forEach(tag => {
          const element = document.createElement('meta');
          element.setAttribute('property', 'article:tag');
          element.setAttribute('content', tag);
          document.head.appendChild(element);
        });
      }
    }

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', seo.description!);
    updateMetaTag('twitter:image', seo.image!);

    // Language and direction
    document.documentElement.lang = 'fa';
    document.documentElement.dir = 'rtl';

    // Add JSON-LD schema
    const addOrUpdateSchema = (schema: any, id: string) => {
      // Remove existing schema with same id
      const existingSchema = document.querySelector(`script[data-schema-id="${id}"]`);
      if (existingSchema) {
        existingSchema.remove();
      }

      // Add new schema
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-schema-id', id);
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    };

    // Always add organization schema
    addOrUpdateSchema(organizationSchema, 'organization');

    // Add custom schema if provided
    if (seo.schema) {
      addOrUpdateSchema(seo.schema, 'custom');
    }

    // Cleanup function to remove article tags when component unmounts
    return () => {
      if (seo.type === 'article' && seo.tags) {
        document.querySelectorAll('meta[property="article:tag"]').forEach(el => el.remove());
      }
    };
  }, [seo, fullTitle]);

  return null;
};

// Helper function to create article schema
export const createArticleSchema = (article: {
  title: string;
  description: string;
  content: string;
  author: string;
  publishedTime: string;
  modifiedTime: string;
  image?: string;
  url: string;
}) => {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "image": article.image,
    "author": {
      "@type": "Person",
      "name": article.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "ویراپ",
      "logo": {
        "@type": "ImageObject",
        "url": "/favicon.ico"
      }
    },
    "datePublished": article.publishedTime,
    "dateModified": article.modifiedTime,
    "url": article.url,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": article.url
    }
  };
};

// Helper function to create service schema
export const createServiceSchema = () => {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "خدمات توسعه نرم‌افزار ویراپ",
    "description": "ارائه خدمات توسعه نرم‌افزار، هوش تجاری، تحلیل داده و هوش مصنوعی",
    "provider": {
      "@type": "Organization",
      "name": "ویراپ"
    },
    "serviceType": "Software Development",
    "areaServed": "Iran",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "خدمات نرم‌افزاری",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "توسعه نرم‌افزار",
            "description": "طراحی و توسعه راه‌حل‌های نرم‌افزاری مدرن، امن و قابل اعتماد"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "هوش تجاری",
            "description": "تبدیل داده‌های خام به بینش‌های قابل اجرا برای تصمیم‌گیری بهتر"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "تحلیل داده",
            "description": "استخراج الگوها و روندهای مهم از داده‌های پیچیده"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "راهکارهای هوش مصنوعی",
            "description": "ارائه سیستم‌ها و ابزارهای مبتنی بر هوش مصنوعی"
          }
        }
      ]
    }
  };
};