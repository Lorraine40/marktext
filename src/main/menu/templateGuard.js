export const stripAcceleratorsFromTemplate = template => {
  if (Array.isArray(template)) {
    return template.map(stripAcceleratorsFromTemplate)
  }

  if (!template || typeof template !== 'object') {
    return template
  }

  const item = {}
  for (const key of Object.keys(template)) {
    if (key === 'accelerator') {
      continue
    }

    const value = template[key]
    item[key] = key === 'submenu' && Array.isArray(value)
      ? stripAcceleratorsFromTemplate(value)
      : value
  }
  return item
}
