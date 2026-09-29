import { InventoryItemModel, InventoryTransactionModel, IInventoryItemDoc } from './model';
import { InventoryItem, InventoryItemSchema, Station, TransactionType } from '@polar-ops/shared';
import { appendEvent } from '../../core/events';
import { nowISO } from '../../core/clock';

export async function listInventory(filter: { station?: string; category?: string; lowStockOnly?: boolean } = {}): Promise<any[]> {
  const query: any = {};
  if (filter.station) query.station = filter.station;
  if (filter.category) query.category = filter.category;
  
  const items: any[] = await InventoryItemModel.find(query).sort({ category: 1, name: 1 }).lean();
  if (filter.lowStockOnly) {
    return items.filter(item => item.quantity <= item.minimumLevel);
  }
  return items;
}

export async function getInventoryById(id: string): Promise<any | null> {
  return InventoryItemModel.findById(id).lean();
}

export async function createInventoryItem(data: Partial<InventoryItem>, actor = 'Station Leader'): Promise<IInventoryItemDoc> {
  const validated = InventoryItemSchema.parse(data);
  const doc = await InventoryItemModel.create(validated);

  await appendEvent('INVENTORY', doc._id.toString(), 'ITEM_CREATED', {
    code: doc.itemCode,
    name: doc.name,
    station: doc.station,
    initialQuantity: doc.quantity
  }, actor);

  return doc;
}

export async function recordTransaction(
  itemId: string,
  type: TransactionType,
  quantity: number,
  reason: string,
  targetStation?: Station,
  actor = 'Logistics Officer'
) {
  const item = await InventoryItemModel.findById(itemId);
  if (!item) throw new Error('Inventory item not found');

  const currentIso = nowISO();
  let qtyDelta = 0;

  if (type === 'RECEIVED') {
    item.quantity += quantity;
    item.lastRestockedDate = currentIso;
    qtyDelta = quantity;
  } else if (type === 'USED') {
    if (item.quantity < quantity) {
      throw new Error(`Insufficient stock for ${item.name}. Available: ${item.quantity}, Requested: ${quantity}`);
    }
    item.quantity -= quantity;
    qtyDelta = -quantity;
  } else if (type === 'TRANSFERRED') {
    if (!targetStation) throw new Error('Target station required for inventory transfer');
    if (item.quantity < quantity) {
      throw new Error(`Insufficient stock for transfer. Available: ${item.quantity}, Requested: ${quantity}`);
    }
    item.quantity -= quantity;

    // Find or create item at target station
    let destItem = await InventoryItemModel.findOne({ itemCode: item.itemCode, station: targetStation });
    if (!destItem) {
      destItem = await InventoryItemModel.create({
        itemCode: item.itemCode,
        name: item.name,
        category: item.category,
        station: targetStation,
        quantity: quantity,
        unit: item.unit,
        minimumLevel: item.minimumLevel,
        dailyBurnRate: item.dailyBurnRate,
        lastRestockedDate: currentIso
      });
    } else {
      destItem.quantity += quantity;
      destItem.lastRestockedDate = currentIso;
      await destItem.save();
    }

    await InventoryTransactionModel.create({
      itemId: destItem._id.toString(),
      itemCode: destItem.itemCode,
      station: targetStation,
      type: 'RECEIVED',
      quantity,
      reason: `Transfer from ${item.station}: ${reason}`,
      actor,
      timestamp: currentIso
    });
  }

  await item.save();

  const transaction = await InventoryTransactionModel.create({
    itemId: item._id.toString(),
    itemCode: item.itemCode,
    station: item.station,
    type,
    quantity,
    reason,
    actor,
    timestamp: currentIso
  });

  await appendEvent('INVENTORY', item._id.toString(), `STOCK_${type}`, {
    itemCode: item.itemCode,
    station: item.station,
    delta: qtyDelta,
    remainingQuantity: item.quantity,
    reason
  }, actor);

  return { item, transaction };
}

export async function listTransactions(itemId?: string, station?: string) {
  const query: any = {};
  if (itemId) query.itemId = itemId;
  if (station) query.station = station;
  return InventoryTransactionModel.find(query).sort({ timestamp: -1 }).limit(100).lean();
}

export async function getInventoryForecast(burnMultiplier = 1) {
  const { now } = await import('../../core/clock');
  const { CrateModel } = await import('../cargo/model');
  const { TransportModel } = await import('../transport/model');
  const { crateEta, forecastInventory } = await import('../../rules');

  const currentDate = now();
  const [items, transactions, crates, transports] = await Promise.all([
    InventoryItemModel.find().lean(),
    InventoryTransactionModel.find().lean(),
    CrateModel.find().lean(),
    TransportModel.find().lean()
  ]);

  const transportsById = transports.reduce<Record<string, any>>((acc, t) => {
    acc[t._id.toString()] = t;
    return acc;
  }, {});

  const incomingResupplies: any[] = [];
  for (const c of crates) {
    if (c.resupplies && c.resupplies.inventoryItemId) {
      const etaRes = crateEta(c as any, transportsById, currentDate);
      incomingResupplies.push({
        crateCode: c.crateCode,
        inventoryItemId: c.resupplies.inventoryItemId,
        quantity: c.resupplies.quantity,
        etaDate: etaRes.etaDate
      });
    }
  }

  return items.map(item =>
    forecastInventory(item as any, transactions as any, incomingResupplies, currentDate, burnMultiplier)
  );
}
