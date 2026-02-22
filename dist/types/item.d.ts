export type StatEffects = {
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
    hp?: number;
};
export type EquipmentSlot = "head" | "torso" | "body" | "legs" | "hands" | "feet" | "mainHand" | "offHand" | "neck" | "ring";
export type Item = {
    id: string;
    name: string;
    pluralName?: string;
    description: string;
    category?: string;
    isBulk?: boolean;
    equipSlot?: EquipmentSlot;
    weaponDamage?: string;
    weaponType?: string;
    magicProperties?: string[];
    effects: StatEffects;
};
export type ItemStack = {
    item: Item;
    quantity: number;
};
//# sourceMappingURL=item.d.ts.map