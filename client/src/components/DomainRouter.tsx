interface DomainRouterProps {
  children: React.ReactNode;
}

export function DomainRouter({ children }: DomainRouterProps) {
  // Legacy host redirects belong at the server/deployment layer. Rewriting here
  // discards the deep path and query before an email CTA can reach its resource.
  return <>{children}</>;
}
