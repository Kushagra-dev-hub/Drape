export type Merchant = { id: string; name: string; endpoint: string };

// Real UCP (MCP) endpoints handed out by hackathon organizers. Append more
// here as they come in — lib/gifts.ts fans out to all of them in parallel.
export const MERCHANTS: Merchant[] = [
  {
    id: "sleep-company",
    name: "The Sleep Company",
    endpoint: "https://thesleepcompanystore.myshopify.com/api/ucp/mcp",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    endpoint: "https://minimalistinc.myshopify.com/api/ucp/mcp",
  },
  {
    id: "aachho",
    name: "Aachho",
    endpoint: "https://www-aachho-com.myshopify.com/api/ucp/mcp",
  },
  {
    id: "bacca-bucci",
    name: "Bacca Bucci",
    endpoint: "https://baccabucci.myshopify.com/api/ucp/mcp",
  },
  {
    id: "milton",
    name: "Milton",
    endpoint: "https://milton-india-store.myshopify.com/api/ucp/mcp",
  },
  {
    id: "speedo",
    name: "Speedo",
    endpoint: "https://speedo-main.myshopify.com/api/ucp/mcp",
  },
  {
    id: "oswaal-books",
    name: "Oswaal Books",
    endpoint: "https://oswaalbooks.myshopify.com/api/ucp/mcp",
  },
  {
    id: "nobero",
    name: "Nobero",
    endpoint: "https://my-dream-store-final.myshopify.com/api/ucp/mcp",
  },
  {
    id: "littlebox-india",
    name: "Littlebox India",
    endpoint: "https://lbindia.myshopify.com/api/ucp/mcp",
  },
  {
    id: "acwo",
    name: "ACwO",
    endpoint: "https://acwo.myshopify.com/api/ucp/mcp",
  },
  {
    id: "giva-jewelry",
    name: "GIVA Jewellery",
    endpoint: "https://giva-jewelry.myshopify.com/api/ucp/mcp",
  },
];
