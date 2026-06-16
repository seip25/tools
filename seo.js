/**
 * Structured SEO data JSON-LD schema builder helper.
 */
class JsonLd {
  /**
   * Generates a Product JSON-LD structured data schema.
   * @param {Object} config - Product configuration.
   * @param {string} config.name - Product name.
   * @param {string} [config.description] - Product description.
   * @param {string} [config.image] - Product image URL.
   * @param {string} [config.sku] - Product SKU.
   * @param {number} config.price - Product price.
   * @param {string} [config.currency="USD"] - Product price currency.
   * @param {boolean} [config.inStock=true] - Product availability status.
   * @returns {Object} The JSON-LD schema object.
   */
  static product(config) {
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": config.name,
      "image": config.image,
      "description": config.description,
      "sku": config.sku,
      "offers": {
        "@type": "Offer",
        "price": config.price,
        "priceCurrency": config.currency || "USD",
        "availability": config.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      }
    };
  }

  /**
   * Generates an Article JSON-LD structured data schema.
   * @param {Object} config - Article configuration.
   * @param {string} config.headline - Article headline.
   * @param {string} [config.description] - Article description.
   * @param {string} [config.image] - Article image URL.
   * @param {string} config.authorName - Name of the article author.
   * @param {string} config.publisherName - Name of the article publisher.
   * @param {string} [config.publisherLogo] - URL of the publisher logo.
   * @param {string} config.datePublished - Article publication date (ISO format).
   * @param {string} [config.dateModified] - Article modification date (ISO format).
   * @returns {Object} The JSON-LD schema object.
   */
  static article(config) {
    return {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": config.headline,
      "description": config.description,
      "image": config.image ? [config.image] : [],
      "datePublished": config.datePublished,
      "dateModified": config.dateModified || config.datePublished,
      "author": [{
        "@type": "Person",
        "name": config.authorName
      }],
      "publisher": {
        "@type": "Organization",
        "name": config.publisherName,
        "logo": config.publisherLogo ? {
          "@type": "ImageObject",
          "url": config.publisherLogo
        } : undefined
      }
    };
  }

  /**
   * Generates an FAQ Page JSON-LD structured data schema.
   * @param {Array<Object>} questions - Array of FAQ items.
   * @param {string} questions[].question - The question text.
   * @param {string} questions[].answer - The answer text.
   * @returns {Object} The JSON-LD schema object.
   */
  static faq(questions) {
    const mainEntity = (questions || []).map(q => ({
      "@type": "Question",
      "name": q.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": q.answer
      }
    }));

    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": mainEntity
    };
  }

  /**
   * Generates a BreadcrumbList JSON-LD structured data schema.
   * @param {Array<Object>} items - Array of breadcrumb items.
   * @param {string} items[].name - The breadcrumb label.
   * @param {string} items[].item - The breadcrumb absolute URL.
   * @returns {Object} The JSON-LD schema object.
   */
  static breadcrumbs(items) {
    const itemListElement = (items || []).map((b, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": b.name,
      "item": b.item
    }));

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": itemListElement
    };
  }

  /**
   * Generates an Organization JSON-LD structured data schema.
   * @param {Object} config - Organization configuration.
   * @param {string} config.name - Organization name.
   * @param {string} config.url - Organization website URL.
   * @param {string} [config.logo] - Organization logo URL.
   * @param {Array<string>} [config.sameAs=[]] - List of social profile URLs.
   * @returns {Object} The JSON-LD schema object.
   */
  static organization(config) {
    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": config.name,
      "url": config.url,
      "logo": config.logo,
      "sameAs": config.sameAs || []
    };
  }
}

export default JsonLd;
