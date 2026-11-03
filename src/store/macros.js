import { createPersistentStore } from './persistentStore'
import { newMacroId, validateMacro } from '../lib/macros'

function sanitize(raw) {
  const unique = new Set()
  return { macros: (Array.isArray(raw?.macros) ? raw.macros : []).filter((macro) => {
    if (!macro || typeof macro.id !== 'string' || unique.has(macro.id)) return false
    unique.add(macro.id)
    return true
  }).slice(0, 100).map((macro) => ({ ...macro, name: String(macro.name ?? '').slice(0, 60), category: String(macro.category ?? 'Gaming').slice(0, 40), steps: Array.isArray(macro.steps) ? macro.steps.slice(0, 30) : [] })) }
}

export const macroStore = createPersistentStore('optinix:macros:v1', { macros: [] }, sanitize)
export const useMacros = macroStore.useStore
export async function saveMacro(macro) {
  const errors = validateMacro(macro)
  if (errors.length) throw new Error(errors.join('\n'))
  return macroStore.change((data) => {
    if (data.macros.length >= 100 && !data.macros.some((item) => item.id === macro.id)) throw new Error('Keep up to 100 macros. Remove one before adding another.')
    return { macros: [...data.macros.filter((item) => item.id !== macro.id), { ...macro, name: macro.name.trim(), category: macro.category.trim(), updatedAt: Date.now() }] }
  })
}
export const deleteMacro = (id) => macroStore.change((data) => ({ macros: data.macros.filter((item) => item.id !== id) }))
export async function duplicateMacro(macro) {
  const next = { ...macro, id: newMacroId(), name: `${macro.name.slice(0, 53)} copy`, steps: macro.steps.map((step) => ({ ...step })) }
  await saveMacro(next)
  return next.id
}
