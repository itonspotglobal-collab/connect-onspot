import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminContractTemplates from "@/pages/AdminContractTemplates";

const target = document.createElement("div");
target.id = "contract-template-test-root";
document.body.appendChild(target);
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false }, mutations: { retry: false } },
});
createRoot(target).render(<QueryClientProvider client={queryClient}><AdminContractTemplates /></QueryClientProvider>);
