import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  UserRole,
  ProjectType,
  ProjectStatus,
  AcquisitionStatus,
  LegalStatus,
  RRStatus,
  DocumentType,
  DocumentStatus,
  CompensationStatus,
  LegalCaseStatus,
  TaskPriority,
  TaskType,
  ProjectRiskLevel
} from '../src/generated/prisma/client'

// Load environment variables
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
})

/**
 * North Karnataka Industrial Corridor (NKIC) GeoJSON Generator
 * Centered around lat 15.14, lng 76.92 (Ballari/Hubli corridor, Karnataka)
 * Realistically spreads 2,000 parcels across 40 villages along a 25-30km corridor radius.
 * Generates quadrilateral polygons roughly 0.5 - 3 acres in visual scale with real lat/lng coordinates.
 * Tags each parcel's geometry consistently with that parcel's actual acquisitionStatus.
 */
function generateParcelGeometry(
  parcelNum: number,
  areaAcres: number,
  acquisitionStatus: string,
  villageNum: number
) {
  // Centroid around lat 15.14, lng 76.92 (near Ballari/Hubli, Karnataka)
  const CENTER_LAT = 15.14
  const CENTER_LNG = 76.92

  // Industrial corridor spine bearing: ~35 degrees (0.61 rad, SW to NE corridor)
  const CORRIDOR_ANGLE = 0.61
  const CORRIDOR_LENGTH_KM = 28 // ~28km total span (-14km to +14km from center)

  // 40 villages distributed along the corridor
  const t = ((villageNum - 1) / 39) - 0.5 // -0.5 to +0.5
  const alongCorridorKm = t * CORRIDOR_LENGTH_KM

  // Meandering lateral offset for each village (up to ~3.2km from corridor centerline)
  const lateralVillageKm = Math.sin(villageNum * 1.7) * 3.2

  // Local dispersion within each village (cadastral distribution up to ~1.2km)
  const parcelInVillage = ((parcelNum - 1) % 50) + 1
  const angle = (parcelInVillage * 137.5 * Math.PI) / 180 // golden angle distribution
  const radiusKm = Math.sqrt(parcelInVillage / 50) * 1.2

  const parcelOffsetX_Km =
    alongCorridorKm * Math.cos(CORRIDOR_ANGLE) -
    lateralVillageKm * Math.sin(CORRIDOR_ANGLE) +
    radiusKm * Math.cos(angle)

  const parcelOffsetY_Km =
    alongCorridorKm * Math.sin(CORRIDOR_ANGLE) +
    lateralVillageKm * Math.cos(CORRIDOR_ANGLE) +
    radiusKm * Math.sin(angle)

  // Convert km offsets to degrees
  // 1° latitude = ~111.0 km
  // 1° longitude at 15.14°N = 111.0 * cos(15.14°) ≈ 107.15 km
  const parcelLat = CENTER_LAT + parcelOffsetY_Km / 111.0
  const parcelLng = CENTER_LNG + parcelOffsetX_Km / 107.15

  // 1 acre ≈ 4046.86 m²
  const areaSqMeters = areaAcres * 4046.86
  const baseSideMeters = Math.sqrt(areaSqMeters)

  // Varied aspect ratio and rotation for natural parcel plot boundaries
  const pseudoSeed = (parcelNum * 9301 + 49297) % 233280
  const pseudoRand1 = pseudoSeed / 233280
  const pseudoRand2 = ((pseudoSeed * 9301 + 49297) % 233280) / 233280

  const aspectRatio = 0.85 + pseudoRand1 * 0.4 // 0.85 to 1.25
  const halfWidthMeters = (baseSideMeters / 2) * Math.sqrt(aspectRatio)
  const halfHeightMeters = (baseSideMeters / 2) / Math.sqrt(aspectRatio)
  const parcelRotation = pseudoRand2 * Math.PI

  // Local 4 corners (quadrilateral with subtle survey variation)
  const rawCorners = [
    [-halfWidthMeters * 0.98, -halfHeightMeters * 0.96],
    [ halfWidthMeters * 1.02, -halfHeightMeters * 1.01],
    [ halfWidthMeters * 0.97,  halfHeightMeters * 1.03],
    [-halfWidthMeters * 1.01,  halfHeightMeters * 0.97]
  ]

  const cosRot = Math.cos(parcelRotation)
  const sinRot = Math.sin(parcelRotation)

  const coords = rawCorners.map(([dx, dy]) => {
    const rotX = dx * cosRot - dy * sinRot
    const rotY = dx * sinRot + dy * cosRot
    const ptLng = parcelLng + rotX / 107150
    const ptLat = parcelLat + rotY / 111000
    return [Number(ptLng.toFixed(6)), Number(ptLat.toFixed(6))]
  })

  // Close the polygon ring (GeoJSON linear ring requires first and last point to be identical)
  coords.push([coords[0][0], coords[0][1]])

  return {
    type: "Polygon",
    coordinates: [coords],
    properties: {
      status: acquisitionStatus,
      areaAcres: areaAcres
    }
  }
}

async function main() {
  console.log('Starting seed...')

  // Clean up existing data in reverse relational order
  await prisma.task.deleteMany()
  await prisma.document.deleteMany()
  await prisma.compensation.deleteMany()
  await prisma.legalCase.deleteMany()
  await prisma.rRRecord.deleteMany()
  await prisma.landParcel.deleteMany()
  await prisma.landowner.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  // Create 5 users, one per role
  const users = await prisma.user.createMany({
    data: [
      {
        name: 'Central Government Officer',
        role: UserRole.CENTRAL,
        state: 'National',
        district: 'National',
        email: 'central@example.com'
      },
      {
        name: 'State Government Officer',
        role: UserRole.STATE,
        state: 'Karnataka',
        district: 'Belgaum',
        email: 'state@example.com'
      },
      {
        name: 'District Government Officer',
        role: UserRole.DISTRICT,
        state: 'Karnataka',
        district: 'Belgaum',
        email: 'district@example.com'
      },
      {
        name: 'Project Officer',
        role: UserRole.PROJECT_OFFICER,
        state: 'Karnataka',
        district: 'Belgaum',
        email: 'projectofficer@example.com'
      },
      {
        name: 'Citizen',
        role: UserRole.CITIZEN,
        state: 'Karnataka',
        district: 'Belgaum',
        email: 'citizen@example.com'
      }
    ]
  })

  console.log(`Created 5 users`)

  // Get the users for creating projects
  const [centralUser, stateUser, districtUser, projectOfficerUser, citizenUser] = await prisma.user.findMany({
    where: {
      role: {
        in: [UserRole.CENTRAL, UserRole.STATE, UserRole.DISTRICT, UserRole.PROJECT_OFFICER, UserRole.CITIZEN]
      }
    }
  })

  // Create 5 projects
  const projects = await prisma.project.createMany({
    data: [
      {
        name: 'North Karnataka Industrial Corridor',
        type: ProjectType.CORRIDOR,
        state: 'Karnataka',
        district: 'Belgaum',
        status: ProjectStatus.ACTIVE,
        startDate: new Date('2023-01-15'),
        targetDate: new Date('2026-12-31'),
        totalParcels: 2000,
        landRequiredAcres: 1500.5,
        landAcquiredAcres: 1005.75, // 67% of required
        compensationAssessed: 4500000000, // ₹450 Cr in rupees
        compensationPaid: 3200000000,    // ₹320 Cr in rupees
        riskScore: 6.5,
        riskLevel: ProjectRiskLevel.HIGH,
        ownerId: stateUser.id
      },
      {
        name: 'Mumbai-Ahmedabad High Speed Rail',
        type: ProjectType.RAIL,
        state: 'Maharashtra',
        district: 'Mumbai',
        status: ProjectStatus.PLANNING,
        startDate: new Date('2024-03-01'),
        targetDate: new Date('2028-03-01'),
        totalParcels: 1200,
        landRequiredAcres: 800.0,
        landAcquiredAcres: 200.0, // 25% of required
        compensationAssessed: 2000000000, // ₹200 Cr
        compensationPaid: 500000000,     // ₹50 Cr
        riskScore: 7.2,
        riskLevel: ProjectRiskLevel.HIGH,
        ownerId: stateUser.id
      },
      {
        name: 'Delhi-Mumbai Industrial Corridor',
        type: ProjectType.CORRIDOR,
        state: 'Delhi',
        district: 'New Delhi',
        status: ProjectStatus.ACTIVE,
        startDate: new Date('2022-06-10'),
        targetDate: new Date('2027-06-10'),
        totalParcels: 3500,
        landRequiredAcres: 2200.0,
        landAcquiredAcres: 1100.0, // 50% of required
        compensationAssessed: 6500000000, // ₹650 Cr
        compensationPaid: 3250000000,    // ₹325 Cr
        riskScore: 5.8,
        riskLevel: ProjectRiskLevel.MEDIUM,
        ownerId: centralUser.id
      },
      {
        name: 'Bengaluru International Airport Expansion',
        type: ProjectType.AIRPORT,
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        status: ProjectStatus.ON_HOLD,
        startDate: new Date('2023-08-20'),
        targetDate: new Date('2025-12-31'),
        totalParcels: 150,
        landRequiredAcres: 75.3,
        landAcquiredAcres: 30.12, // 40% of required
        compensationAssessed: 450000000, // ₹45 Cr
        compensationPaid: 180000000,    // ₹18 Cr
        riskScore: 4.2,
        riskLevel: ProjectRiskLevel.MEDIUM,
        ownerId: stateUser.id
      },
      {
        name: 'Kerala Solar Power Project',
        type: ProjectType.POWER,
        state: 'Kerala',
        district: 'Thiruvananthapuram',
        status: ProjectStatus.ACTIVE,
        startDate: new Date('2023-11-05'),
        targetDate: new Date('2025-06-30'),
        totalParcels: 800,
        landRequiredAcres: 400.0,
        landAcquiredAcres: 280.0, // 70% of required
        compensationAssessed: 1200000000, // ₹120 Cr
        compensationPaid: 840000000,     // ₹84 Cr
        riskScore: 3.1,
        riskLevel: ProjectRiskLevel.LOW,
        ownerId: districtUser.id
      }
    ]
  })

  console.log(`Created 5 projects`)

  // Get the detailed project for creating parcels
  const detailedProject = await prisma.project.findFirst({
    where: {
      name: 'North Karnataka Industrial Corridor'
    }
  })

  if (!detailedProject) {
    throw new Error('Could not find detailed project')
  }

  // Create landowners (we'll need about 2000 for 2000 parcels, but some may own multiple parcels)
  // Let's create 1800 unique landowners (assuming some own multiple parcels)
  const landowners = []
  for (let i = 1; i <= 1800; i++) {
    landowners.push({
      name: `Landowner ${i}`,
      contactInfo: {
        phone: `+91-${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        email: `landowner${i}@example.com`,
        address: `Village ${Math.ceil(i / 20)}, Taluka ${Math.ceil(i / 100)}, Belgaum`
      }
    })
  }

  const createdLandowners = await prisma.landowner.createMany({
    data: landowners
  })

  console.log(`Created 1800 landowners`)

  // Get all landowners for assigning to parcels
  const allLandowners = await prisma.landowner.findMany()

  // Create 2000 land parcels for the detailed project with specified distribution
  // Status breakdown:
  // - 1,356 Acquired (67.8%)
  // - 421 in various "under process" statuses (21.05%)
  //   - VERIFICATION: ~105
  //   - NOTIFICATION: ~105
  //   - OBJECTION: ~105
  //   - COMPENSATION_PROCESSING: ~106
  // - 143 LEGAL_DISPUTE (7.15%)
  // - 80 NOT_STARTED (4.0%)

  const parcelsToCreate = []

  // Acquired parcels (1356)
  for (let i = 1; i <= 1356; i++) {
    const landownerIndex = (i - 1) % allLandowners.length
    const areaAcres = parseFloat((Math.random() * 2 + 0.5).toFixed(2)) // 0.5 to 2.5 acres
    const villageNum = Math.ceil(i / 50)
    parcelsToCreate.push({
      projectId: detailedProject.id,
      parcelCode: `NKIC-${String(i).padStart(4, '0')}`,
      surveyNumber: `SNO/${Math.floor(Math.random() * 9999 + 1)}/${Math.floor(Math.random() * 99 + 1)}`,
      ownerId: allLandowners[landownerIndex].id,
      areaAcres,
      village: `Village ${villageNum}`,
      district: detailedProject.district,
      state: detailedProject.state,
      geometry: generateParcelGeometry(i, areaAcres, AcquisitionStatus.ACQUIRED, villageNum),
      acquisitionStatus: AcquisitionStatus.ACQUIRED,
      legalStatus: Math.random() > 0.95 ? LegalStatus.DISPUTE_PENDING : LegalStatus.NONE, // 5% have legal issues
      rrStatus: Math.random() > 0.9 ? RRStatus.COMPLETED : Math.random() > 0.7 ? RRStatus.PROCESSING : RRStatus.ELIGIBLE
    })
  }

  // Under process parcels (421)
  const underProcessStatuses = [AcquisitionStatus.VERIFICATION, AcquisitionStatus.NOTIFICATION, AcquisitionStatus.OBJECTION, AcquisitionStatus.COMPENSATION_PROCESSING]
  const underProcessCounts = [105, 105, 105, 106] // totals 421

  let underProcessIndex = 1356
  for (let statusIdx = 0; statusIdx < underProcessStatuses.length; statusIdx++) {
    const status = underProcessStatuses[statusIdx]
    const count = underProcessCounts[statusIdx]

    for (let i = 0; i < count; i++) {
      const parcelNum = underProcessIndex + i + 1
      const landownerIndex = (parcelNum - 1) % allLandowners.length
      const areaAcres = parseFloat((Math.random() * 2 + 0.5).toFixed(2))
      const villageNum = Math.ceil(parcelNum / 50)
      parcelsToCreate.push({
        projectId: detailedProject.id,
        parcelCode: `NKIC-${String(parcelNum).padStart(4, '0')}`,
        surveyNumber: `SNO/${Math.floor(Math.random() * 9999 + 1)}/${Math.floor(Math.random() * 99 + 1)}`,
        ownerId: allLandowners[landownerIndex].id,
        areaAcres,
        village: `Village ${villageNum}`,
        district: detailedProject.district,
        state: detailedProject.state,
        geometry: generateParcelGeometry(parcelNum, areaAcres, status, villageNum),
        acquisitionStatus: status,
        legalStatus: Math.random() > 0.9 ? LegalStatus.DISPUTE_PENDING : LegalStatus.NONE,
        rrStatus: status === AcquisitionStatus.COMPENSATION_PROCESSING ? RRStatus.PROCESSING :
                  Math.random() > 0.8 ? RRStatus.ELIGIBLE : RRStatus.NOT_ASSESSED
      })
    }
    underProcessIndex += count
  }

  // Legal Dispute parcels (143)
  for (let i = 1; i <= 143; i++) {
    const parcelNum = 1356 + 421 + i
    const landownerIndex = (parcelNum - 1) % allLandowners.length
    const areaAcres = parseFloat((Math.random() * 2 + 0.5).toFixed(2))
    const villageNum = Math.ceil(parcelNum / 50)
    parcelsToCreate.push({
      projectId: detailedProject.id,
      parcelCode: `NKIC-${String(parcelNum).padStart(4, '0')}`,
      surveyNumber: `SNO/${Math.floor(Math.random() * 9999 + 1)}/${Math.floor(Math.random() * 99 + 1)}`,
      ownerId: allLandowners[landownerIndex].id,
      areaAcres,
      village: `Village ${villageNum}`,
      district: detailedProject.district,
      state: detailedProject.state,
      geometry: generateParcelGeometry(parcelNum, areaAcres, AcquisitionStatus.LEGAL_DISPUTE, villageNum),
      acquisitionStatus: AcquisitionStatus.LEGAL_DISPUTE,
      legalStatus: LegalStatus.DISPUTE_PENDING,
      rrStatus: RRStatus.NOT_ASSESSED
    })
  }

  // Not Started parcels (80)
  for (let i = 1; i <= 80; i++) {
    const parcelNum = 1356 + 421 + 143 + i
    const landownerIndex = (parcelNum - 1) % allLandowners.length
    const areaAcres = parseFloat((Math.random() * 2 + 0.5).toFixed(2))
    const villageNum = Math.ceil(parcelNum / 50)
    parcelsToCreate.push({
      projectId: detailedProject.id,
      parcelCode: `NKIC-${String(parcelNum).padStart(4, '0')}`,
      surveyNumber: `SNO/${Math.floor(Math.random() * 9999 + 1)}/${Math.floor(Math.random() * 99 + 1)}`,
      ownerId: allLandowners[landownerIndex].id,
      areaAcres,
      village: `Village ${villageNum}`,
      district: detailedProject.district,
      state: detailedProject.state,
      geometry: generateParcelGeometry(parcelNum, areaAcres, AcquisitionStatus.NOT_STARTED, villageNum),
      acquisitionStatus: AcquisitionStatus.NOT_STARTED,
      legalStatus: LegalStatus.NONE,
      rrStatus: RRStatus.NOT_ASSESSED
    })
  }

  // Shuffle the parcels to distribute them more realistically
  for (let i = parcelsToCreate.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[parcelsToCreate[i], parcelsToCreate[j]] = [parcelsToCreate[j], parcelsToCreate[i]]
  }

  // Create parcels in batches to avoid too many parameters
  const BATCH_SIZE = 100
  for (let i = 0; i < parcelsToCreate.length; i += BATCH_SIZE) {
    const batch = parcelsToCreate.slice(i, i + BATCH_SIZE)
    await prisma.landParcel.createMany({ data: batch })
  }

  console.log(`Created 2000 land parcels`)

  // ── DEMO PARCEL: force NKIC-0001 to exact known values for demo/testing ──
  const demoGeometry = generateParcelGeometry(1, 2.5, AcquisitionStatus.ACQUIRED, 1)
  const demoParcel = await prisma.landParcel.update({
    where: { parcelCode: 'NKIC-0001' },
    data: {
      areaAcres: 2.5,
      village: 'Kalaghatgi Village',
      acquisitionStatus: AcquisitionStatus.ACQUIRED,
      legalStatus: LegalStatus.NONE,
      rrStatus: RRStatus.COMPLETED,
      geometry: demoGeometry,
      owner: {
        update: {
          name: 'Ramesh Kumar Patil',
          contactInfo: {
            phone: '+91-9845012345',
            email: 'ramesh.patil@example.com',
            address: 'Survey No. 142, Kalaghatgi Village, Belgaum'
          }
        }
      }
    }
  })
  console.log(`Demo parcel NKIC-0001 set: areaAcres=2.5, owner=Ramesh Kumar Patil`)
  // ─────────────────────────────────────────────────────────────────────────

  // Get all parcels for creating related data
  const allParcels = await prisma.landParcel.findMany({
    where: { projectId: detailedProject.id }
  })

  // Create documents for parcels (let's say 2-3 documents per parcel on average)
  const documentTypes = [DocumentType.OWNERSHIP, DocumentType.SURVEY, DocumentType.NOTIFICATION, DocumentType.COMPENSATION, DocumentType.LEGAL, DocumentType.RR]
  const documentStatuses = [DocumentStatus.PENDING, DocumentStatus.VERIFIED, DocumentStatus.MISMATCH]

  const documentsToCreate = []

  for (const parcel of allParcels) {
    // 2-4 documents per parcel
    const docCount = Math.floor(Math.random() * 3) + 2

    for (let i = 0; i < docCount; i++) {
      const typeIndex = Math.floor(Math.random() * documentTypes.length)
      const statusIndex = Math.floor(Math.random() * documentStatuses.length)

      // Cast to any to bypass strict TypeScript checking for Json fields
      documentsToCreate.push({
        parcelId: parcel.id,
        type: documentTypes[typeIndex],
        status: documentStatuses[statusIndex],
        extractedFields: statusIndex === 1 /* VERIFIED */ ? {
          name: `Extracted Name ${Math.floor(Math.random() * 1000)}`,
          area: parcel.areaAcres.toString(),
          date: new Date().toISOString().split('T')[0]
        } : (null as any),
        dbComparisonResult: statusIndex === 1 /* VERIFIED */ ? {
          matches: Math.random() > 0.2,
          mismatchedFields: Math.random() > 0.7 ? ['area', 'name'] : []
        } : (null as any)
      })
    }
  }

  // Create documents in batches
  for (let i = 0; i < documentsToCreate.length; i += BATCH_SIZE) {
    const batch = documentsToCreate.slice(i, i + BATCH_SIZE)
    await prisma.document.createMany({ data: batch })
  }

  console.log(`Created ${documentsToCreate.length} documents`)

  // Create compensation records for parcels (only for those with compensation status not NOT_ASSESSED)
  const compensationToCreate = []

  for (const parcel of allParcels) {
    // Skip NOT_STARTED and some early stage parcels for compensation
    if (parcel.acquisitionStatus === AcquisitionStatus.NOT_STARTED ||
        parcel.acquisitionStatus === AcquisitionStatus.VERIFICATION ||
        parcel.acquisitionStatus === AcquisitionStatus.NOTIFICATION) {
      continue
    }

    // Determine compensation status based on acquisition status
    let compStatus: CompensationStatus = CompensationStatus.NOT_ASSESSED
    let paidAmount = 0
    let assessedAmount = 0

    switch (parcel.acquisitionStatus) {
      case AcquisitionStatus.ACQUIRED:
        compStatus = Math.random() > 0.3 ? CompensationStatus.FULLY_PAID : CompensationStatus.PARTIALLY_PAID
        assessedAmount = parcel.areaAcres * 300000 // ₹3 lakhs per acre
        paidAmount = compStatus === CompensationStatus.FULLY_PAID ? assessedAmount : assessedAmount * 0.6
        break
      case AcquisitionStatus.POSSESSION:
        compStatus = CompensationStatus.PARTIALLY_PAID
        assessedAmount = parcel.areaAcres * 280000
        paidAmount = assessedAmount * 0.4
        break
      case AcquisitionStatus.COMPENSATION_PAID:
        compStatus = CompensationStatus.PARTIALLY_PAID
        assessedAmount = parcel.areaAcres * 250000
        paidAmount = assessedAmount * 0.3
        break
      case AcquisitionStatus.COMPENSATION_PROCESSING:
        compStatus = CompensationStatus.NOT_ASSESSED
        assessedAmount = parcel.areaAcres * 220000
        paidAmount = 0
        break
      default:
        compStatus = CompensationStatus.NOT_ASSESSED
        assessedAmount = parcel.areaAcres * 200000
        paidAmount = 0
    }

    compensationToCreate.push({
      parcelId: parcel.id,
      assessedAmount: parseFloat(assessedAmount.toFixed(2)),
      paidAmount: parseFloat(paidAmount.toFixed(2)),
      status: compStatus
    })
  }

  // Create compensation in batches
  for (let i = 0; i < compensationToCreate.length; i += BATCH_SIZE) {
    const batch = compensationToCreate.slice(i, i + BATCH_SIZE)
    await prisma.compensation.createMany({ data: batch })
  }

  console.log(`Created ${compensationToCreate.length} compensation records`)

  // ── DEMO PARCEL compensation: force exact values on NKIC-0001 ──
  await prisma.compensation.upsert({
    where: { parcelId: demoParcel.id },
    create: {
      parcelId: demoParcel.id,
      assessedAmount: 1840000,   // ₹18,40,000
      paidAmount:     1200000,   // ₹12,00,000
      status:         CompensationStatus.PARTIALLY_PAID
    },
    update: {
      assessedAmount: 1840000,
      paidAmount:     1200000,
      status:         CompensationStatus.PARTIALLY_PAID
    }
  })

  // ── DEMO PARCEL document: force one doc with extractedFields.landArea = 2.1 ──
  await prisma.document.create({
    data: {
      parcelId: demoParcel.id,
      type:     DocumentType.SURVEY,
      status:   DocumentStatus.VERIFIED,
      extractedFields: {
        landArea:    2.1,
        ownerName:   'Ramesh Kumar Patil',
        surveyDate:  '2023-04-15',
        district:    'Belgaum',
        taluka:      'Kalaghatgi'
      },
      dbComparisonResult: {
        matches:          false,
        mismatchedFields: ['landArea']  // doc says 2.1, DB has 2.5 acres
      }
    }
  })
  console.log(`Demo parcel NKIC-0001 compensation and document set`)
  // ───────────────────────────────────────────────────────────────

  // Create legal cases for parcels with LEGAL_DISPUTE status
  const legalCasesToCreate = []

  const legalDisputeParcels = allParcels.filter(p => p.acquisitionStatus === AcquisitionStatus.LEGAL_DISPUTE)

  for (const parcel of legalDisputeParcels) {
    legalCasesToCreate.push({
      parcelId: parcel.id,
      caseId: `CASE-${String(Math.floor(Math.random() * 90000 + 10000)).padStart(5, '0')}`,
      issueType: Math.random() > 0.5 ? 'TITLE_DISPUTE' : 'BOUNDARY_DISPUTE',
      status: Math.random() > 0.7 ? LegalCaseStatus.CLOSED : LegalCaseStatus.OPEN,
      daysPending: Math.floor(Math.random() * 1000),
      responsibleDept: Math.random() > 0.5 ? 'Revenue Department' : 'Legal Affairs'
    })
  }

  // Create legal cases in batches
  for (let i = 0; i < legalCasesToCreate.length; i += BATCH_SIZE) {
    const batch = legalCasesToCreate.slice(i, i + BATCH_SIZE)
    await prisma.legalCase.createMany({ data: batch })
  }

  console.log(`Created ${legalCasesToCreate.length} legal cases`)

  // Create RR records for parcels (eligible for rehabilitation & resettlement)
  const rrRecordsToCreate = []

  for (const parcel of allParcels) {
    // Only create RR records for parcels that are not NOT_STARTED and have some progress
    if (parcel.acquisitionStatus === AcquisitionStatus.NOT_STARTED) {
      continue
    }

    // Determine eligibility based on area and status
    const isEligible = parcel.areaAcres > 0.5 &&
                      parcel.acquisitionStatus !== AcquisitionStatus.VERIFICATION

    if (isEligible) {
      rrRecordsToCreate.push({
        parcelId: parcel.id,
        familyId: `FAM-${String(Math.floor(Math.random() * 9000 + 1000)).padStart(4, '0')}`,
        status: Math.random() > 0.6 ? RRStatus.COMPLETED :
               Math.random() > 0.3 ? RRStatus.PROCESSING :
               Math.random() > 0.1 ? RRStatus.DOCS_PENDING : RRStatus.ELIGIBLE
      })
    }
  }

  // Create RR records in batches
  for (let i = 0; i < rrRecordsToCreate.length; i += BATCH_SIZE) {
    const batch = rrRecordsToCreate.slice(i, i + BATCH_SIZE)
    await prisma.rRRecord.createMany({ data: batch })
  }

  console.log(`Created ${rrRecordsToCreate.length} RR records`)

  // Create tasks for the project
  const tasksToCreate = []

  const taskTypes = [
    TaskType.FIELD_VERIFICATION,
    TaskType.DOCUMENT_REVIEW,
    TaskType.COMPENSATION_CALCULATION,
    TaskType.LEGAL_PROCESSING,
    TaskType.RR_PROCESSING,
    TaskType.SITE_VISIT,
    TaskType.MEETING,
    TaskType.REPORT_GENERATION
  ]

  const priorities = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH]

  // Create some sample tasks
  for (let i = 1; i <= 50; i++) {
    const taskTypeIndex = Math.floor(Math.random() * taskTypes.length)
    const priorityIndex = Math.floor(Math.random() * priorities.length)

    // Assign to different roles (responsibleRole is a String field)
    let responsibleRole = 'PROJECT_OFFICER'
    if (Math.random() > 0.7) responsibleRole = 'DISTRICT'
    if (Math.random() > 0.8) responsibleRole = 'STATE'

    tasksToCreate.push({
      projectId: detailedProject.id,
      parcelId: Math.random() > 0.3 ? allParcels[Math.floor(Math.random() * allParcels.length)].id : null,
      type: taskTypes[taskTypeIndex],
      description: `Task ${i}: Perform ${taskTypes[taskTypeIndex].toLowerCase().replace(/_/g, ' ')} for project activities`,
      responsibleRole,
      dueDate: Math.random() > 0.5 ? new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000) : null,
      daysPending: Math.floor(Math.random() * 50),
      priority: priorities[priorityIndex],
      resolved: Math.random() > 0.7
    })
  }

  // Create tasks in batches
  for (let i = 0; i < tasksToCreate.length; i += BATCH_SIZE) {
    const batch = tasksToCreate.slice(i, i + BATCH_SIZE)
    await prisma.task.createMany({ data: batch })
  }

  console.log(`Created ${tasksToCreate.length} tasks`)

  console.log('Seed completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })