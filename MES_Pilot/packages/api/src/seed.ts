import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Site } from './modules/core/entities/site.entity.js';
import { Area } from './modules/core/entities/area.entity.js';
import { WorkCenter } from './modules/core/entities/work-center.entity.js';
import { WorkUnit } from './modules/core/entities/work-unit.entity.js';
import { User } from './modules/users/entities/user.entity.js';
import { Role } from './modules/users/entities/role.entity.js';
import { UserArea } from './modules/users/entities/user-area.entity.js';
import { AuditLog } from './modules/audit/entities/audit-log.entity.js';
import { Product } from './modules/recipes/entities/product.entity.js';
import { Material } from './modules/recipes/entities/material.entity.js';
import { MasterRecipe } from './modules/recipes/entities/master-recipe.entity.js';
import { RecipePhase } from './modules/recipes/entities/recipe-phase.entity.js';
import { RecipeParameter } from './modules/recipes/entities/recipe-parameter.entity.js';
import { RecipeMaterial } from './modules/recipes/entities/recipe-material.entity.js';
import { ControlRecipe } from './modules/recipes/entities/control-recipe.entity.js';
import { ReasonCode } from './modules/config/entities/reason-code.entity.js';
import { ConfigOverride } from './modules/config/entities/config-override.entity.js';
import { QcTemplate } from './modules/quality/entities/qc-template.entity.js';
import { QcTemplateParam } from './modules/quality/entities/qc-template-param.entity.js';
import { QcCheck } from './modules/quality/entities/qc-check.entity.js';
import { QcResult } from './modules/quality/entities/qc-result.entity.js';
import { QcDeviation } from './modules/quality/entities/qc-deviation.entity.js';
import { QcHold } from './modules/quality/entities/qc-hold.entity.js';
import { WorkOrder } from './modules/jobs/entities/work-order.entity.js';
import { WorkOrderStep } from './modules/jobs/entities/work-order-step.entity.js';
import { ProductionLog } from './modules/jobs/entities/production-log.entity.js';

config({ path: '../../.env' });

function getDbConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } as any : false,
    };
  }
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'mes_pilot',
    username: process.env.DATABASE_USER || 'woutertielemans',
    password: process.env.DATABASE_PASSWORD || '',
  };
}

const dataSource = new DataSource({
  type: 'postgres',
  ...getDbConfig(),
  entities: [
    Site, Area, WorkCenter, WorkUnit,
    User, Role, UserArea, AuditLog,
    Product, Material, MasterRecipe, RecipePhase, RecipeParameter, RecipeMaterial, ControlRecipe,
    ReasonCode, ConfigOverride,
    QcTemplate, QcTemplateParam, QcCheck, QcResult, QcDeviation, QcHold,
    WorkOrder, WorkOrderStep, ProductionLog,
  ],
  synchronize: true,
  logging: false,
});

async function seed() {
  await dataSource.initialize();
  console.log('Connected to database. Seeding...\n');

  // ── Roles ──────────────────────────────────────────────
  const roleRepo = dataSource.getRepository(Role);
  const rolesData = [
    { name: 'Operator', permissions: ['job:view', 'job:start', 'job:complete', 'qc:view', 'qc:inspect', 'recipe:view'] },
    { name: 'Supervisor', permissions: ['job:view', 'job:create', 'job:start', 'job:complete', 'job:hold', 'job:reassign', 'qc:view', 'qc:inspect', 'qc:deviate', 'qc:hold', 'qc:release', 'recipe:view', 'config:view'] },
    { name: 'QC Inspector', permissions: ['job:view', 'qc:view', 'qc:inspect', 'qc:deviate', 'qc:hold', 'qc:release', 'recipe:view'] },
    { name: 'Engineer', permissions: ['job:view', 'qc:view', 'recipe:view', 'recipe:edit', 'recipe:approve', 'recipe:obsolete', 'config:view', 'config:edit'] },
    { name: 'Admin', permissions: ['job:view', 'job:create', 'job:start', 'job:complete', 'job:hold', 'job:reassign', 'qc:view', 'qc:inspect', 'qc:deviate', 'qc:hold', 'qc:release', 'recipe:view', 'recipe:edit', 'recipe:approve', 'recipe:obsolete', 'config:view', 'config:edit', 'user:view', 'user:manage'] },
  ];

  const roles: Record<string, Role> = {};
  for (const r of rolesData) {
    let role = await roleRepo.findOneBy({ name: r.name });
    if (!role) role = await roleRepo.save(roleRepo.create(r));
    roles[r.name] = role;
  }
  console.log(`✓ ${Object.keys(roles).length} roles`);

  // ── Site ────────────────────────────────────────────────
  const siteRepo = dataSource.getRepository(Site);
  let site = await siteRepo.findOneBy({});
  if (!site) {
    site = await siteRepo.save(siteRepo.create({
      nameI18n: { en: 'Plant Amsterdam', nl: 'Fabriek Amsterdam', zh: '阿姆斯特丹工厂' },
      timezone: 'Europe/Amsterdam',
      locale: 'en',
    }));
  }
  console.log(`✓ Site: ${site.nameI18n.en}`);

  // ── Areas ───────────────────────────────────────────────
  const areaRepo = dataSource.getRepository(Area);
  const areasData = [
    { nameI18n: { en: 'Batch Manufacturing', nl: 'Batchproductie', zh: '批量生产' }, areaType: 'batch' },
    { nameI18n: { en: 'Discrete Assembly', nl: 'Discrete Assemblage', zh: '离散组装' }, areaType: 'discrete' },
    { nameI18n: { en: 'Packaging', nl: 'Verpakking', zh: '包装' }, areaType: 'packaging' },
  ];

  const areas: Area[] = [];
  for (const a of areasData) {
    let area = await areaRepo.findOneBy({ areaType: a.areaType, siteId: site.id });
    if (!area) area = await areaRepo.save(areaRepo.create({ ...a, siteId: site.id }));
    areas.push(area);
  }
  console.log(`✓ ${areas.length} areas`);

  // ── Work Centers ────────────────────────────────────────
  const wcRepo = dataSource.getRepository(WorkCenter);
  const wcData = [
    // Batch
    { areaIdx: 0, nameI18n: { en: 'Mixing Vessel A', nl: 'Mengvat A', zh: '混合罐A' } },
    { areaIdx: 0, nameI18n: { en: 'Mixing Vessel B', nl: 'Mengvat B', zh: '混合罐B' } },
    // Discrete
    { areaIdx: 1, nameI18n: { en: 'Assembly Line 1', nl: 'Assemblagelijn 1', zh: '装配线1' } },
    { areaIdx: 1, nameI18n: { en: 'Assembly Line 2', nl: 'Assemblagelijn 2', zh: '装配线2' } },
    // Packaging
    { areaIdx: 2, nameI18n: { en: 'Packaging Line 1', nl: 'Verpakkingslijn 1', zh: '包装线1' } },
    { areaIdx: 2, nameI18n: { en: 'Packaging Line 2', nl: 'Verpakkingslijn 2', zh: '包装线2' } },
  ];

  const workCenters: WorkCenter[] = [];
  for (const wc of wcData) {
    const areaId = areas[wc.areaIdx].id;
    let existing = await wcRepo.findOneBy({ areaId, nameI18n: wc.nameI18n });
    if (!existing) existing = await wcRepo.save(wcRepo.create({ nameI18n: wc.nameI18n, areaId }));
    workCenters.push(existing);
  }
  console.log(`✓ ${workCenters.length} work centers`);

  // ── Work Units ──────────────────────────────────────────
  const wuRepo = dataSource.getRepository(WorkUnit);
  const wuData = [
    { wcIdx: 0, nameI18n: { en: 'Agitator', nl: 'Roerwerk', zh: '搅拌器' }, unitType: 'agitator' },
    { wcIdx: 0, nameI18n: { en: 'Heater', nl: 'Verwarming', zh: '加热器' }, unitType: 'heater' },
    { wcIdx: 1, nameI18n: { en: 'Agitator', nl: 'Roerwerk', zh: '搅拌器' }, unitType: 'agitator' },
    { wcIdx: 2, nameI18n: { en: 'Robot Arm 1', nl: 'Robotarm 1', zh: '机器人臂1' }, unitType: 'robot' },
    { wcIdx: 2, nameI18n: { en: 'Robot Arm 2', nl: 'Robotarm 2', zh: '机器人臂2' }, unitType: 'robot' },
    { wcIdx: 3, nameI18n: { en: 'Robot Arm 1', nl: 'Robotarm 1', zh: '机器人臂1' }, unitType: 'robot' },
    { wcIdx: 4, nameI18n: { en: 'Filler', nl: 'Vuller', zh: '灌装机' }, unitType: 'filler' },
    { wcIdx: 4, nameI18n: { en: 'Capper', nl: 'Dopsluiter', zh: '压盖机' }, unitType: 'capper' },
    { wcIdx: 4, nameI18n: { en: 'Labeller', nl: 'Etiketteermachine', zh: '贴标机' }, unitType: 'labeller' },
    { wcIdx: 5, nameI18n: { en: 'Filler', nl: 'Vuller', zh: '灌装机' }, unitType: 'filler' },
    { wcIdx: 5, nameI18n: { en: 'Capper', nl: 'Dopsluiter', zh: '压盖机' }, unitType: 'capper' },
  ];

  let wuCount = 0;
  for (const wu of wuData) {
    const workCenterId = workCenters[wu.wcIdx].id;
    const existing = await wuRepo.findOneBy({ workCenterId, unitType: wu.unitType, nameI18n: wu.nameI18n });
    if (!existing) {
      await wuRepo.save(wuRepo.create({ nameI18n: wu.nameI18n, unitType: wu.unitType, workCenterId }));
    }
    wuCount++;
  }
  console.log(`✓ ${wuCount} work units`);

  // ── Users ───────────────────────────────────────────────
  const userRepo = dataSource.getRepository(User);
  const usersData = [
    { email: 'admin@mes.local', displayName: 'Admin User', preferredLocale: 'en' },
    { email: 'supervisor@mes.local', displayName: 'Jan de Vries', preferredLocale: 'nl' },
    { email: 'operator1@mes.local', displayName: 'Maria Jansen', preferredLocale: 'nl' },
    { email: 'operator2@mes.local', displayName: 'Wei Zhang', preferredLocale: 'zh' },
    { email: 'engineer@mes.local', displayName: 'Sarah Collins', preferredLocale: 'en' },
    { email: 'qc@mes.local', displayName: 'Pieter Bakker', preferredLocale: 'nl' },
  ];

  const users: User[] = [];
  for (const u of usersData) {
    let user = await userRepo.findOneBy({ email: u.email });
    if (!user) user = await userRepo.save(userRepo.create(u));
    users.push(user);
  }
  console.log(`✓ ${users.length} users`);

  // ── User-Area Assignments ──────────────────────────────
  const uaRepo = dataSource.getRepository(UserArea);
  const assignments = [
    // Admin → all areas as Admin
    ...areas.map(a => ({ userId: users[0].id, areaId: a.id, roleId: roles['Admin'].id })),
    // Supervisor → all areas as Supervisor
    ...areas.map(a => ({ userId: users[1].id, areaId: a.id, roleId: roles['Supervisor'].id })),
    // Operator 1 → batch + packaging as Operator
    { userId: users[2].id, areaId: areas[0].id, roleId: roles['Operator'].id },
    { userId: users[2].id, areaId: areas[2].id, roleId: roles['Operator'].id },
    // Operator 2 → discrete + packaging as Operator
    { userId: users[3].id, areaId: areas[1].id, roleId: roles['Operator'].id },
    { userId: users[3].id, areaId: areas[2].id, roleId: roles['Operator'].id },
    // Engineer → all areas as Engineer
    ...areas.map(a => ({ userId: users[4].id, areaId: a.id, roleId: roles['Engineer'].id })),
    // QC Inspector → all areas as QC Inspector
    ...areas.map(a => ({ userId: users[5].id, areaId: a.id, roleId: roles['QC Inspector'].id })),
  ];

  let assignCount = 0;
  for (const a of assignments) {
    const existing = await uaRepo.findOneBy({ userId: a.userId, areaId: a.areaId });
    if (!existing) {
      await uaRepo.save(uaRepo.create(a));
      assignCount++;
    }
  }
  console.log(`✓ ${assignCount} user-area assignments`);

  // ── Products ────────────────────────────────────────────
  const productRepo = dataSource.getRepository(Product);
  const productsData = [
    { sku: 'SOAP-500', nameI18n: { en: 'Liquid Hand Soap 500ml', nl: 'Vloeibare Handzeep 500ml', zh: '液体洗手液500ml' }, descriptionI18n: { en: 'Premium liquid hand soap', nl: 'Premium vloeibare handzeep', zh: '高级液体洗手液' } },
    { sku: 'SHAM-250', nameI18n: { en: 'Shampoo 250ml', nl: 'Shampoo 250ml', zh: '洗发水250ml' }, descriptionI18n: { en: 'Daily care shampoo', nl: 'Dagelijkse verzorging shampoo', zh: '日常护理洗发水' } },
    { sku: 'LOTN-200', nameI18n: { en: 'Body Lotion 200ml', nl: 'Bodylotion 200ml', zh: '身体乳200ml' }, descriptionI18n: { en: 'Moisturizing body lotion', nl: 'Hydraterende bodylotion', zh: '保湿身体乳' } },
    { sku: 'DISH-750', nameI18n: { en: 'Dish Soap 750ml', nl: 'Afwasmiddel 750ml', zh: '洗洁精750ml' }, descriptionI18n: { en: 'Concentrated dish soap', nl: 'Geconcentreerd afwasmiddel', zh: '浓缩洗洁精' } },
    { sku: 'COND-300', nameI18n: { en: 'Conditioner 300ml', nl: 'Conditioner 300ml', zh: '护发素300ml' }, descriptionI18n: { en: 'Hair conditioner', nl: 'Haarconditioner', zh: '护发素' } },
  ];

  const products: Product[] = [];
  for (const p of productsData) {
    let product = await productRepo.findOneBy({ sku: p.sku });
    if (!product) product = await productRepo.save(productRepo.create(p));
    products.push(product);
  }
  console.log(`✓ ${products.length} products`);

  // ── Materials ───────────────────────────────────────────
  const materialRepo = dataSource.getRepository(Material);
  const materialsData = [
    { code: 'RM-WATER', nameI18n: { en: 'Purified Water', nl: 'Gezuiverd Water', zh: '纯净水' }, category: 'raw_material', unitOfMeasure: 'L' },
    { code: 'RM-SLS', nameI18n: { en: 'Sodium Lauryl Sulfate', nl: 'Natriumlaurylsulfaat', zh: '十二烷基硫酸钠' }, category: 'raw_material', unitOfMeasure: 'kg' },
    { code: 'RM-GLYC', nameI18n: { en: 'Glycerin', nl: 'Glycerine', zh: '甘油' }, category: 'raw_material', unitOfMeasure: 'kg' },
    { code: 'RM-FRAG', nameI18n: { en: 'Fragrance Oil', nl: 'Geurolie', zh: '香精油' }, category: 'raw_material', unitOfMeasure: 'ml' },
    { code: 'RM-PRES', nameI18n: { en: 'Preservative', nl: 'Conserveermiddel', zh: '防腐剂' }, category: 'raw_material', unitOfMeasure: 'g' },
    { code: 'RM-COLR', nameI18n: { en: 'Color Dye', nl: 'Kleurstof', zh: '色素' }, category: 'raw_material', unitOfMeasure: 'g' },
    { code: 'PM-BTL500', nameI18n: { en: 'Bottle 500ml', nl: 'Fles 500ml', zh: '500ml瓶' }, category: 'packaging', unitOfMeasure: 'pcs' },
    { code: 'PM-BTL250', nameI18n: { en: 'Bottle 250ml', nl: 'Fles 250ml', zh: '250ml瓶' }, category: 'packaging', unitOfMeasure: 'pcs' },
    { code: 'PM-CAP', nameI18n: { en: 'Pump Cap', nl: 'Pompdop', zh: '泵盖' }, category: 'packaging', unitOfMeasure: 'pcs' },
    { code: 'PM-LBL', nameI18n: { en: 'Product Label', nl: 'Productlabel', zh: '产品标签' }, category: 'packaging', unitOfMeasure: 'pcs' },
    { code: 'PM-CBOX', nameI18n: { en: 'Carton Box (12 units)', nl: 'Kartonnen Doos (12 stuks)', zh: '纸箱(12件)' }, category: 'packaging', unitOfMeasure: 'pcs' },
  ];

  const materials: Material[] = [];
  for (const m of materialsData) {
    let material = await materialRepo.findOneBy({ code: m.code });
    if (!material) material = await materialRepo.save(materialRepo.create(m));
    materials.push(material);
  }
  console.log(`✓ ${materials.length} materials`);

  // ── Reason Codes ────────────────────────────────────────
  const rcRepo = dataSource.getRepository(ReasonCode);
  const reasonCodesData = [
    // Site-level (no areaId)
    { areaId: null, category: 'downtime', nameI18n: { en: 'Planned Maintenance', nl: 'Gepland Onderhoud', zh: '计划维护' }, requiresComment: false },
    { areaId: null, category: 'downtime', nameI18n: { en: 'Unplanned Breakdown', nl: 'Ongeplande Storing', zh: '意外故障' }, requiresComment: true },
    { areaId: null, category: 'downtime', nameI18n: { en: 'Changeover', nl: 'Omstelling', zh: '换线' }, requiresComment: false },
    { areaId: null, category: 'downtime', nameI18n: { en: 'No Operator', nl: 'Geen Operator', zh: '无操作员' }, requiresComment: false },
    { areaId: null, category: 'downtime', nameI18n: { en: 'Waiting for Material', nl: 'Wachten op Materiaal', zh: '等待物料' }, requiresComment: true },
    { areaId: null, category: 'reject', nameI18n: { en: 'Weight Out of Spec', nl: 'Gewicht Buiten Spec', zh: '重量超标' }, requiresComment: false },
    { areaId: null, category: 'reject', nameI18n: { en: 'Visual Defect', nl: 'Visueel Defect', zh: '外观缺陷' }, requiresComment: true },
    { areaId: null, category: 'reject', nameI18n: { en: 'Contamination', nl: 'Verontreiniging', zh: '污染' }, requiresComment: true },
    { areaId: null, category: 'reject', nameI18n: { en: 'Label Error', nl: 'Labelfout', zh: '标签错误' }, requiresComment: false },
    { areaId: null, category: 'hold', nameI18n: { en: 'Quality Hold', nl: 'Kwaliteitsblokkering', zh: '质量冻结' }, requiresComment: true },
    { areaId: null, category: 'hold', nameI18n: { en: 'Material Hold', nl: 'Materiaalblokkering', zh: '物料冻结' }, requiresComment: true },
    // Batch-specific
    { areaId: areas[0].id, category: 'downtime', nameI18n: { en: 'CIP Cleaning', nl: 'CIP Reiniging', zh: 'CIP清洗' }, requiresComment: false },
    { areaId: areas[0].id, category: 'reject', nameI18n: { en: 'Viscosity Out of Spec', nl: 'Viscositeit Buiten Spec', zh: '粘度超标' }, requiresComment: true },
    // Packaging-specific
    { areaId: areas[2].id, category: 'downtime', nameI18n: { en: 'Film Break', nl: 'Foliebreuk', zh: '薄膜断裂' }, requiresComment: false },
    { areaId: areas[2].id, category: 'reject', nameI18n: { en: 'Seal Failure', nl: 'Sealfout', zh: '密封失败' }, requiresComment: false },
  ];

  let rcCount = 0;
  for (const rc of reasonCodesData) {
    const q: any = { category: rc.category };
    if (rc.areaId) q.areaId = rc.areaId;
    const existing = await rcRepo.findOneBy(q);
    // Avoid duplicates but don't over-check — just insert if category+area combo is new
    if (!existing) {
      await rcRepo.save(rcRepo.create(rc as any));
      rcCount++;
    }
  }
  console.log(`✓ ${rcCount} reason codes`);

  // ── Master Recipes (active) ────────────────────────────
  const recipeRepo = dataSource.getRepository(MasterRecipe);
  const phaseRepo = dataSource.getRepository(RecipePhase);
  const paramRepo = dataSource.getRepository(RecipeParameter);
  const rmRepo = dataSource.getRepository(RecipeMaterial);

  // Recipe 1: Liquid Hand Soap (batch)
  let soapRecipe = await recipeRepo.findOneBy({ productId: products[0].id, status: 'active' });
  if (!soapRecipe) {
    soapRecipe = await recipeRepo.save(recipeRepo.create({
      productId: products[0].id,
      version: 1,
      status: 'active',
      areaType: 'batch',
      applicableWorkCenters: [workCenters[0].id, workCenters[1].id],
      createdBy: users[4].id,
      approvedBy: users[0].id,
      approvedAt: new Date(),
      notes: 'Standard liquid hand soap formulation v1',
    }));

    // Phase 1: Preparation
    const p1 = await phaseRepo.save(phaseRepo.create({
      recipeId: soapRecipe.id, sequence: 1,
      nameI18n: { en: 'Water Preparation', nl: 'Waterbereiding', zh: '水的准备' },
      phaseType: 'preparation', durationTargetMin: 15,
      instructionsI18n: { en: 'Heat purified water to 70°C', nl: 'Verwarm gezuiverd water tot 70°C', zh: '将纯净水加热至70°C' },
    }));
    await paramRepo.save(paramRepo.create({ phaseId: p1.id, nameI18n: { en: 'Water Temperature', nl: 'Watertemperatuur', zh: '水温' }, paramType: 'setpoint', value: 70, unit: '°C', lowerLimit: 65, upperLimit: 75 }));

    // Phase 2: Mixing
    const p2 = await phaseRepo.save(phaseRepo.create({
      recipeId: soapRecipe.id, sequence: 2,
      nameI18n: { en: 'Ingredient Mixing', nl: 'Ingrediëntmenging', zh: '原料混合' },
      phaseType: 'processing', durationTargetMin: 45,
      instructionsI18n: { en: 'Add SLS and glycerin, mix at 200 RPM for 30 min, then add fragrance and preservative', nl: 'Voeg SLS en glycerine toe, meng op 200 RPM gedurende 30 min, voeg dan geur en conserveermiddel toe', zh: '加入SLS和甘油，以200RPM搅拌30分钟，然后加入香料和防腐剂' },
    }));
    await paramRepo.save(paramRepo.create({ phaseId: p2.id, nameI18n: { en: 'Mixing Speed', nl: 'Mengsnelheid', zh: '搅拌速度' }, paramType: 'setpoint', value: 200, unit: 'RPM', lowerLimit: 180, upperLimit: 220 }));
    await paramRepo.save(paramRepo.create({ phaseId: p2.id, nameI18n: { en: 'Temperature', nl: 'Temperatuur', zh: '温度' }, paramType: 'setpoint', value: 65, unit: '°C', lowerLimit: 60, upperLimit: 70 }));

    // Phase 3: Quality Hold
    const p3 = await phaseRepo.save(phaseRepo.create({
      recipeId: soapRecipe.id, sequence: 3,
      nameI18n: { en: 'pH Adjustment', nl: 'pH-aanpassing', zh: 'pH调节' },
      phaseType: 'finishing', durationTargetMin: 10,
      instructionsI18n: { en: 'Adjust pH to 5.5 ± 0.3', nl: 'Pas pH aan naar 5.5 ± 0.3', zh: '将pH调至5.5 ± 0.3' },
    }));
    await paramRepo.save(paramRepo.create({ phaseId: p3.id, nameI18n: { en: 'pH', nl: 'pH', zh: 'pH' }, paramType: 'setpoint', value: 5.5, unit: '', lowerLimit: 5.2, upperLimit: 5.8 }));

    // Phase 4: CIP
    await phaseRepo.save(phaseRepo.create({
      recipeId: soapRecipe.id, sequence: 4,
      nameI18n: { en: 'CIP Cleaning', nl: 'CIP Reiniging', zh: 'CIP清洗' },
      phaseType: 'cleaning', durationTargetMin: 30,
      instructionsI18n: { en: 'Run CIP cycle per standard procedure', nl: 'Voer CIP-cyclus uit volgens standaardprocedure', zh: '按标准程序执行CIP循环' },
    }));

    // Materials for soap recipe
    await rmRepo.save(rmRepo.create({ recipeId: soapRecipe.id, phaseId: p1.id, materialId: materials[0].id, quantityPerBatch: 400, unit: 'L', isCritical: true, scalingType: 'linear' }));
    await rmRepo.save(rmRepo.create({ recipeId: soapRecipe.id, phaseId: p2.id, materialId: materials[1].id, quantityPerBatch: 25, unit: 'kg', isCritical: true, scalingType: 'linear' }));
    await rmRepo.save(rmRepo.create({ recipeId: soapRecipe.id, phaseId: p2.id, materialId: materials[2].id, quantityPerBatch: 15, unit: 'kg', isCritical: false, scalingType: 'linear' }));
    await rmRepo.save(rmRepo.create({ recipeId: soapRecipe.id, phaseId: p2.id, materialId: materials[3].id, quantityPerBatch: 500, unit: 'ml', isCritical: false, scalingType: 'linear' }));
    await rmRepo.save(rmRepo.create({ recipeId: soapRecipe.id, phaseId: p2.id, materialId: materials[4].id, quantityPerBatch: 100, unit: 'g', isCritical: true, scalingType: 'linear' }));
  }
  console.log(`✓ Recipe: ${products[0].nameI18n.en}`);

  // Recipe 2: Shampoo (batch)
  let shampooRecipe = await recipeRepo.findOneBy({ productId: products[1].id, status: 'active' });
  if (!shampooRecipe) {
    shampooRecipe = await recipeRepo.save(recipeRepo.create({
      productId: products[1].id, version: 1, status: 'active', areaType: 'batch',
      applicableWorkCenters: [workCenters[0].id, workCenters[1].id],
      createdBy: users[4].id, approvedBy: users[0].id, approvedAt: new Date(),
      notes: 'Daily care shampoo formulation',
    }));

    const sp1 = await phaseRepo.save(phaseRepo.create({ recipeId: shampooRecipe.id, sequence: 1, nameI18n: { en: 'Aqueous Phase', nl: 'Waterfase', zh: '水相' }, phaseType: 'preparation', durationTargetMin: 20 }));
    await paramRepo.save(paramRepo.create({ phaseId: sp1.id, nameI18n: { en: 'Temperature', nl: 'Temperatuur', zh: '温度' }, paramType: 'setpoint', value: 75, unit: '°C', lowerLimit: 70, upperLimit: 80 }));

    const sp2 = await phaseRepo.save(phaseRepo.create({ recipeId: shampooRecipe.id, sequence: 2, nameI18n: { en: 'Emulsification', nl: 'Emulgering', zh: '乳化' }, phaseType: 'processing', durationTargetMin: 30 }));
    await paramRepo.save(paramRepo.create({ phaseId: sp2.id, nameI18n: { en: 'Homogenizer Speed', nl: 'Homogenisator Snelheid', zh: '均质机速度' }, paramType: 'setpoint', value: 3000, unit: 'RPM', lowerLimit: 2800, upperLimit: 3200 }));

    await phaseRepo.save(phaseRepo.create({ recipeId: shampooRecipe.id, sequence: 3, nameI18n: { en: 'Cooling & Addition', nl: 'Koeling & Toevoeging', zh: '冷却与添加' }, phaseType: 'finishing', durationTargetMin: 25 }));
    await phaseRepo.save(phaseRepo.create({ recipeId: shampooRecipe.id, sequence: 4, nameI18n: { en: 'CIP Cleaning', nl: 'CIP Reiniging', zh: 'CIP清洗' }, phaseType: 'cleaning', durationTargetMin: 30 }));

    await rmRepo.save(rmRepo.create({ recipeId: shampooRecipe.id, phaseId: sp1.id, materialId: materials[0].id, quantityPerBatch: 350, unit: 'L', isCritical: true, scalingType: 'linear' }));
    await rmRepo.save(rmRepo.create({ recipeId: shampooRecipe.id, phaseId: sp2.id, materialId: materials[1].id, quantityPerBatch: 40, unit: 'kg', isCritical: true, scalingType: 'linear' }));
    await rmRepo.save(rmRepo.create({ recipeId: shampooRecipe.id, phaseId: sp2.id, materialId: materials[2].id, quantityPerBatch: 20, unit: 'kg', isCritical: false, scalingType: 'linear' }));
  }
  console.log(`✓ Recipe: ${products[1].nameI18n.en}`);

  // Recipe 3: Dish Soap Packaging (packaging)
  let dishRecipe = await recipeRepo.findOneBy({ productId: products[3].id, status: 'active' });
  if (!dishRecipe) {
    dishRecipe = await recipeRepo.save(recipeRepo.create({
      productId: products[3].id, version: 1, status: 'active', areaType: 'packaging',
      applicableWorkCenters: [workCenters[4].id, workCenters[5].id],
      createdBy: users[4].id, approvedBy: users[0].id, approvedAt: new Date(),
      notes: 'Dish soap 750ml packaging process',
    }));

    const dp1 = await phaseRepo.save(phaseRepo.create({ recipeId: dishRecipe.id, sequence: 1, nameI18n: { en: 'Line Setup', nl: 'Lijn Instelling', zh: '产线设置' }, phaseType: 'preparation', durationTargetMin: 15 }));
    const dp2 = await phaseRepo.save(phaseRepo.create({ recipeId: dishRecipe.id, sequence: 2, nameI18n: { en: 'Filling & Capping', nl: 'Vullen & Doppen', zh: '灌装与压盖' }, phaseType: 'processing', durationTargetMin: 480 }));
    await paramRepo.save(paramRepo.create({ phaseId: dp2.id, nameI18n: { en: 'Fill Weight', nl: 'Vulgewicht', zh: '灌装重量' }, paramType: 'setpoint', value: 750, unit: 'g', lowerLimit: 745, upperLimit: 755 }));
    await paramRepo.save(paramRepo.create({ phaseId: dp2.id, nameI18n: { en: 'Line Speed', nl: 'Lijnsnelheid', zh: '线速度' }, paramType: 'setpoint', value: 120, unit: 'units/min', lowerLimit: 100, upperLimit: 140 }));

    await phaseRepo.save(phaseRepo.create({ recipeId: dishRecipe.id, sequence: 3, nameI18n: { en: 'Labelling & Boxing', nl: 'Etiketteren & Verpakken', zh: '贴标与装箱' }, phaseType: 'finishing', durationTargetMin: 480 }));

    await rmRepo.save(rmRepo.create({ recipeId: dishRecipe.id, phaseId: dp1.id, materialId: materials[6].id, quantityPerBatch: 1, unit: 'pcs', isCritical: true, scalingType: 'linear' }));
    await rmRepo.save(rmRepo.create({ recipeId: dishRecipe.id, phaseId: dp2.id, materialId: materials[8].id, quantityPerBatch: 1, unit: 'pcs', isCritical: true, scalingType: 'linear' }));
    await rmRepo.save(rmRepo.create({ recipeId: dishRecipe.id, phaseId: dp2.id, materialId: materials[9].id, quantityPerBatch: 1, unit: 'pcs', isCritical: false, scalingType: 'linear' }));
  }
  console.log(`✓ Recipe: ${products[3].nameI18n.en}`);

  // ── QC Templates ────────────────────────────────────────
  const qcTemplateRepo = dataSource.getRepository(QcTemplate);
  const qcParamRepo = dataSource.getRepository(QcTemplateParam);

  // Fill weight check for packaging
  let fillWeightTemplate = await qcTemplateRepo.findOneBy({ trigger: 'timed_interval', areaId: areas[2].id });
  if (!fillWeightTemplate) {
    fillWeightTemplate = await qcTemplateRepo.save(qcTemplateRepo.create({
      areaId: areas[2].id,
      nameI18n: { en: 'Fill Weight Check', nl: 'Vulgewicht Controle', zh: '灌装重量检查' },
      trigger: 'timed_interval',
      triggerValue: 30,
      isMandatory: true,
      applicableWorkCenters: [workCenters[4].id, workCenters[5].id],
    }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: fillWeightTemplate.id, nameI18n: { en: 'Fill Weight', nl: 'Vulgewicht', zh: '灌装重量' }, paramType: 'numeric', unit: 'g', targetValue: 500, lowerLimit: 495, upperLimit: 505, sequence: 1 }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: fillWeightTemplate.id, nameI18n: { en: 'Cap Torque', nl: 'Dopkoppel', zh: '盖扭矩' }, paramType: 'numeric', unit: 'Nm', targetValue: 1.5, lowerLimit: 1.2, upperLimit: 1.8, sequence: 2 }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: fillWeightTemplate.id, nameI18n: { en: 'Label Position OK', nl: 'Labelpositie OK', zh: '标签位置正常' }, paramType: 'boolean', sequence: 3 }));
  }
  console.log(`✓ QC Template: Fill Weight Check`);

  // pH check for batch
  let phTemplate = await qcTemplateRepo.findOneBy({ trigger: 'on_complete', areaId: areas[0].id });
  if (!phTemplate) {
    phTemplate = await qcTemplateRepo.save(qcTemplateRepo.create({
      areaId: areas[0].id,
      nameI18n: { en: 'Batch Release Check', nl: 'Batch Vrijgave Controle', zh: '批次放行检查' },
      trigger: 'on_complete',
      isMandatory: true,
      applicableWorkCenters: [workCenters[0].id, workCenters[1].id],
    }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: phTemplate.id, nameI18n: { en: 'pH', nl: 'pH', zh: 'pH' }, paramType: 'numeric', unit: '', targetValue: 5.5, lowerLimit: 5.2, upperLimit: 5.8, sequence: 1 }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: phTemplate.id, nameI18n: { en: 'Viscosity', nl: 'Viscositeit', zh: '粘度' }, paramType: 'numeric', unit: 'cP', targetValue: 3000, lowerLimit: 2500, upperLimit: 3500, sequence: 2 }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: phTemplate.id, nameI18n: { en: 'Color Acceptable', nl: 'Kleur Acceptabel', zh: '颜色合格' }, paramType: 'boolean', sequence: 3 }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: phTemplate.id, nameI18n: { en: 'Fragrance Acceptable', nl: 'Geur Acceptabel', zh: '气味合格' }, paramType: 'boolean', sequence: 4 }));
  }
  console.log(`✓ QC Template: Batch Release Check`);

  // Startup check for all areas
  let startupTemplate = await qcTemplateRepo.findOneBy({ trigger: 'on_start', areaId: null as any });
  if (!startupTemplate) {
    startupTemplate = await qcTemplateRepo.save(qcTemplateRepo.create({
      nameI18n: { en: 'Startup Safety Check', nl: 'Opstart Veiligheidscontrole', zh: '启动安全检查' },
      trigger: 'on_start',
      isMandatory: true,
    }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: startupTemplate.id, nameI18n: { en: 'Guards in Place', nl: 'Beveiligingen Geplaatst', zh: '安全防护到位' }, paramType: 'boolean', sequence: 1 }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: startupTemplate.id, nameI18n: { en: 'Area Clean', nl: 'Omgeving Schoon', zh: '区域清洁' }, paramType: 'boolean', sequence: 2 }));
    await qcParamRepo.save(qcParamRepo.create({ templateId: startupTemplate.id, nameI18n: { en: 'Materials Verified', nl: 'Materialen Geverifieerd', zh: '物料已验证' }, paramType: 'boolean', sequence: 3 }));
  }
  console.log(`✓ QC Template: Startup Safety Check`);

  // ── Work Orders ─────────────────────────────────────────
  const woRepo = dataSource.getRepository(WorkOrder);
  const workOrdersData = [
    { orderNumber: 'WO-2026-001', productIdx: 0, areaIdx: 0, wcIdx: 0, quantityTarget: 1000, status: 'released', priority: 1, createdBy: users[1].id },
    { orderNumber: 'WO-2026-002', productIdx: 0, areaIdx: 0, wcIdx: 1, quantityTarget: 1000, status: 'draft', priority: 2, createdBy: users[1].id },
    { orderNumber: 'WO-2026-003', productIdx: 1, areaIdx: 0, wcIdx: 0, quantityTarget: 500, status: 'released', priority: 3, createdBy: users[1].id },
    { orderNumber: 'WO-2026-004', productIdx: 3, areaIdx: 2, wcIdx: 4, quantityTarget: 10000, status: 'released', priority: 1, createdBy: users[1].id },
    { orderNumber: 'WO-2026-005', productIdx: 3, areaIdx: 2, wcIdx: 5, quantityTarget: 8000, status: 'draft', priority: 2, createdBy: users[1].id },
  ];

  let woCount = 0;
  for (const wo of workOrdersData) {
    const existing = await woRepo.findOneBy({ orderNumber: wo.orderNumber });
    if (!existing) {
      await woRepo.save(woRepo.create({
        orderNumber: wo.orderNumber,
        productId: products[wo.productIdx].id,
        areaId: areas[wo.areaIdx].id,
        workCenterId: workCenters[wo.wcIdx].id,
        quantityTarget: wo.quantityTarget,
        status: wo.status,
        priority: wo.priority,
        scheduledStart: new Date(Date.now() + woCount * 8 * 3600000),
        createdBy: wo.createdBy,
      }));
      woCount++;
    }
  }
  console.log(`✓ ${woCount} work orders`);

  // ── Done ────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('Login credentials (dev mode):');
  console.log('  Admin:      admin@mes.local');
  console.log('  Supervisor: supervisor@mes.local');
  console.log('  Operator 1: operator1@mes.local');
  console.log('  Operator 2: operator2@mes.local');
  console.log('  Engineer:   engineer@mes.local');
  console.log('  QC:         qc@mes.local');

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
