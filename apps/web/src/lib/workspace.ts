export function workspaceHref(slug: string, path = "/dashboard") {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) return "/"
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `/w/${slug}${suffix}`
}
