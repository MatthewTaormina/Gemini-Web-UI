export interface MetaNode {
    name: string;
    value: string | number | boolean | null;
    children: { [key: string]: MetaNode };
}

/**
 * Validates that the metadata follows the strict recursive structure:
 * { [key: string]: { name: string, value: any, children: { ... } } }
 * Strictly forbids arrays.
 */
export function validateMetadata(meta: any): boolean {
    if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
        return false;
    }

    for (const key in meta) {
        const node = meta[key];
        
        // Check node structure
        if (typeof node !== 'object' || node === null || Array.isArray(node)) {
            return false;
        }

        // Validate required fields
        if (typeof node.name !== 'string') return false;
        if (node.children === undefined || typeof node.children !== 'object' || Array.isArray(node.children)) {
            return false;
        }

        // Value must be a primitive (no objects/arrays as values, use children for nesting)
        const valType = typeof node.value;
        if (node.value !== null && valType !== 'string' && valType !== 'number' && valType !== 'boolean') {
            return false;
        }

        // Recurse into children
        if (!validateMetadata(node.children)) {
            return false;
        }
    }

    return true;
}
