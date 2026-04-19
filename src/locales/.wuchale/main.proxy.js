
            
            /** @typedef {() => Promise<import("wuchale/runtime").CatalogModule>} CatalogMod */
            /** @typedef {{[locale: string]: CatalogMod}} KeyCatalogs */
            /** @type {{[loadID: string]: KeyCatalogs}} */
            const catalogs = {main: {en: () => import('./main.main.en.compiled.js'),'pt-BR': () => import('./main.main.pt-BR.compiled.js')}}
            export const loadCatalog = (/** @type {string} */ loadID, /** @type {string} */ locale) => {
                return /** @type {CatalogMod} */ (/** @type {KeyCatalogs} */ (catalogs[loadID])[locale])()
            }
            export const loadIDs = ['main']
        