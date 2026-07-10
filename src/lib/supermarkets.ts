/**
 * Supermarket deep links.
 *
 * Honest scope note: UK supermarkets don't offer public "add to basket"
 * APIs, so a true basket export isn't possible without scraping or partner
 * agreements. What CAN be done reliably — and is done here — is deep-linking
 * each shopping-list item straight to the supermarket's product search, so
 * shopping becomes "click item → click first result" rather than re-typing.
 */

export interface SupermarketLink {
  name: string;
  /** Builds a product-search URL for a query. */
  searchUrl: (query: string) => string;
  /** Shown when the shop has no useful online groceries search. */
  note?: string;
}

const q = (s: string) => encodeURIComponent(s.trim());

export const SUPERMARKET_LINKS: SupermarketLink[] = [
  {
    name: "Tesco",
    searchUrl: (s) => `https://www.tesco.com/groceries/en-GB/search?query=${q(s)}`,
  },
  {
    name: "Sainsbury's",
    searchUrl: (s) =>
      `https://www.sainsburys.co.uk/gol-ui/SearchResults/${q(s)}`,
  },
  {
    name: "Asda",
    searchUrl: (s) => `https://groceries.asda.com/search/${q(s)}`,
  },
  {
    name: "Morrisons",
    searchUrl: (s) => `https://groceries.morrisons.com/search?entry=${q(s)}`,
  },
  {
    name: "Aldi",
    searchUrl: (s) => `https://www.aldi.co.uk/results?q=${q(s)}`,
    note: "Aldi's website is mostly Specialbuys — most groceries are in-store only.",
  },
  {
    name: "Lidl",
    searchUrl: (s) => `https://www.lidl.co.uk/search?query=${q(s)}`,
    note: "Lidl doesn't sell groceries online — links show product info only.",
  },
  {
    name: "Waitrose",
    searchUrl: (s) =>
      `https://www.waitrose.com/ecom/shop/search?searchTerm=${q(s)}`,
  },
  {
    name: "Co-op",
    searchUrl: (s) => `https://shop.coop.co.uk/search?term=${q(s)}`,
  },
  {
    name: "Iceland",
    searchUrl: (s) => `https://www.iceland.co.uk/search?q=${q(s)}`,
  },
  {
    name: "Ocado",
    searchUrl: (s) => `https://www.ocado.com/search?entry=${q(s)}`,
  },
  {
    name: "Cook",
    searchUrl: (s) => `https://www.cookfood.net/search/?q=${q(s)}`,
  },
];

/** Links for the user's chosen supermarkets, primary first. */
export function linksFor(
  supermarketNames: string[],
  primary?: string
): SupermarketLink[] {
  const chosen = SUPERMARKET_LINKS.filter((l) =>
    supermarketNames.some((n) => n.toLowerCase() === l.name.toLowerCase())
  );
  if (!primary) return chosen;
  return [...chosen].sort((a, b) =>
    a.name.toLowerCase() === primary.toLowerCase()
      ? -1
      : b.name.toLowerCase() === primary.toLowerCase()
        ? 1
        : 0
  );
}
