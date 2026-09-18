"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../src/generated/prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_2 = require("../src/generated/prisma/client");
const prisma = new client_1.PrismaClient({
    adapter: new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL })
});
async function main() {
    console.log('Starting seed...');
    // Create 5 users, one per role
    const users = await prisma.user.createMany({
        data: [
            {
                name: 'Central Government Officer',
                role: client_2.UserRole.CENTRAL,
                state: 'National',
                district: 'National',
                email: 'central@example.com'
            },
            {
                name: 'State Government Officer',
                role: client_2.UserRole.STATE,
                state: 'Karnataka',
                district: 'Belgaum',
                email: 'state@example.com'
            },
            {
                name: 'District Government Officer',
                role: client_2.UserRole.DISTRICT,
                state: 'Karnataka',
                district: 'Belgaum',
                email: 'district@example.com'
            },
            {
                name: 'Project Officer',
                role: client_2.UserRole.PROJECT_OFFICER,
                state: 'Karnataka',
                district: 'Belgaum',
                email: 'projectofficer@example.com'
            },
            {
                name: 'Citizen',
                role: client_2.UserRole.CITIZEN,
                state: 'Karnataka',
                district: 'Belgaum',
                email: 'citizen@example.com'
            }
        ]
    });
    console.log(`Created 5 users`);
    // Get the users for creating projects
    const [centralUser, stateUser, districtUser, projectOfficerUser, citizenUser] = await prisma.user.findMany({
        where: {
            role: {
                in: [client_2.UserRole.CENTRAL, client_2.UserRole.STATE, client_2.UserRole.DISTRICT, client_2.UserRole.PROJECT_OFFICER, client_2.UserRole.CITIZEN]
            }
        }
    });
    // Create 5 projects
    const projects = await prisma.project.createMany({
        data: [
            {
                name: 'North Karnataka Industrial Corridor',
                type: client_2.ProjectType.CORRIDOR,
                state: 'Karnataka',
                district: 'Belgaum',
                status: client_2.ProjectStatus.ACTIVE,
                startDate: new Date('2023-01-15'),
                targetDate: new Date('2026-12-31'),
                totalParcels: 2000,
                landRequiredAcres: 1500.5,
                landAcquiredAcres: 1005.75, // 67% of required
                compensationAssessed: 4500000000, // ₹450 Cr in rupees
                compensationPaid: 3200000000, // ₹320 Cr in rupees
                riskScore: 6.5,
                riskLevel: client_2.ProjectRiskLevel.HIGH,
                ownerId: stateUser.id
            },
            {
                name: 'Mumbai-Ahmedabad High Speed Rail',
                type: client_2.ProjectType.RAIL,
                state: 'Maharashtra',
                district: 'Mumbai',
                status: client_2.ProjectStatus.PLANNING,
                startDate: new Date('2024-03-01'),
                targetDate: new Date('2028-03-01'),
                totalParcels: 1200,
                landRequiredAcres: 800.0,
                landAcquiredAcres: 200.0, // 25% of required
                compensationAssessed: 2000000000, // ₹200 Cr
                compensationPaid: 500000000, // ₹50 Cr
                riskScore: 7.2,
                riskLevel: client_2.ProjectRiskLevel.HIGH,
                ownerId: stateUser.id
            },
            {
                name: 'Delhi-Mumbai Industrial Corridor',
                type: client_2.ProjectType.CORRIDOR,
                state: 'Delhi',
                district: 'New Delhi',
                status: client_2.ProjectStatus.ACTIVE,
                startDate: new Date('2022-06-10'),
                targetDate: new Date('2027-06-10'),
                totalParcels: 3500,
                landRequiredAcres: 2200.0,
                landAcquiredAcres: 1100.0, // 50% of required
                compensationAssessed: 6500000000, // ₹650 Cr
                compensationPaid: 3250000000, // ₹325 Cr
                riskScore: 5.8,
                riskLevel: client_2.ProjectRiskLevel.MEDIUM,
                ownerId: centralUser.id
            },
            {
                name: 'Bengaluru International Airport Expansion',
                type: client_2.ProjectType.AIRPORT,
                state: 'Karnataka',
                district: 'Bengaluru Urban',
                status: client_2.ProjectStatus.ON_HOLD,
                startDate: new Date('2023-08-20'),
                targetDate: new Date('2025-12-31'),
                totalParcels: 150,
                landRequiredAcres: 75.3,
                landAcquiredAcres: 30.12, // 40% of required
                compensationAssessed: 450000000, // ₹45 Cr
                compensationPaid: 180000000, // ₹18 Cr
                riskScore: 4.2,
                riskLevel: client_2.ProjectRiskLevel.MEDIUM,
                ownerId: stateUser.id
            },
            {
                name: 'Kerala Solar Power Project',
                type: client_2.ProjectType.POWER,
                state: 'Kerala',
                district: 'Thiruvananthapuram',
                status: client_2.ProjectStatus.ACTIVE,
                startDate: new Date('2023-11-05'),
                targetDate: new Date('2025-06-30'),
                totalParcels: 800,
                landRequiredAcres: 400.0,
                landAcquiredAcres: 280.0, // 70% of required
                compensationAssessed: 1200000000, // ₹120 Cr
                compensationPaid: 840000000, // ₹84 Cr
                riskScore: 3.1,
                riskLevel: client_2.ProjectRiskLevel.LOW,
                ownerId: districtUser.id
            }
        ]
    });
    console.log(`Created 5 projects`);
    // Get the detailed project for creating parcels
    const detailedProject = await prisma.project.findFirst({
        where: {
            name: 'North Karnataka Industrial Corridor'
        }
    });
    if (!detailedProject) {
        throw new Error('Could not find detailed project');
    }
    // Create landowners (we'll need about 2000 for 2000 parcels, but some may own multiple parcels)
    // Let's create 1800 unique landowners (assuming some own multiple parcels)
    const landowners = [];
    for (let i = 1; i <= 1800; i++) {
        landowners.push({
            name: `Landowner ${i}`,
            contactInfo: {
                phone: `+91-${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
                email: `landowner${i}@example.com`,
                address: `Village ${Math.ceil(i / 20)}, Taluka ${Math.ceil(i / 100)}, Belgaum`
            }
        });
    }
    const createdLandowners = await prisma.landowner.createMany({
        data: landowners
    });
    console.log(`Created 1800 landowners`);
    // Get all landowners for assigning to parcels
    const allLandowners = await prisma.landowner.findMany();
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
    const parcelsToCreate = [];
    // Acquired parcels (1356)
    for (let i = 1; i <= 1356; i++) {
        const landownerIndex = (i - 1) % allLandowners.length;
        parcelsToCreate.push({
            projectId: detailedProject.id,
            parcelCode: `NKIC-${String(i).padStart(4, '0')}`,
            surveyNumber: `SNO/${Math.floor(Math.random() * 9999 + 1)}/${Math.floor(Math.random() * 99 + 1)}`,
            ownerId: allLandowners[landownerIndex].id,
            areaAcres: parseFloat((Math.random() * 2 + 0.5).toFixed(2)), // 0.5 to 2.5 acres
            village: `Village ${Math.ceil(i / 50)}`,
            district: detailedProject.district,
            state: detailedProject.state,
            geometry: {
                type: "Polygon",
                coordinates: [[
                        [0, 0], [1, 0], [1, 1], [0, 1], [0, 0]
                    ]]
            },
            acquisitionStatus: client_2.AcquisitionStatus.ACQUIRED,
            legalStatus: Math.random() > 0.95 ? client_2.LegalStatus.DISPUTE_PENDING : client_2.LegalStatus.NONE, // 5% have legal issues
            rrStatus: Math.random() > 0.9 ? client_2.RRStatus.COMPLETED : Math.random() > 0.7 ? client_2.RRStatus.PROCESSING : client_2.RRStatus.ELIGIBLE
        });
    }
    // Under process parcels (421)
    const underProcessStatuses = [client_2.AcquisitionStatus.VERIFICATION, client_2.AcquisitionStatus.NOTIFICATION, client_2.AcquisitionStatus.OBJECTION, client_2.AcquisitionStatus.COMPENSATION_PROCESSING];
    const underProcessCounts = [105, 105, 105, 106]; // totals 421
    let underProcessIndex = 1356;
    for (let statusIdx = 0; statusIdx < underProcessStatuses.length; statusIdx++) {
        const status = underProcessStatuses[statusIdx];
        const count = underProcessCounts[statusIdx];
        for (let i = 0; i < count; i++) {
            const parcelNum = underProcessIndex + i + 1;
            const landownerIndex = (parcelNum - 1) % allLandowners.length;
            parcelsToCreate.push({
                projectId: detailedProject.id,
                parcelCode: `NKIC-${String(parcelNum).padStart(4, '0')}`,
                surveyNumber: `SNO/${Math.floor(Math.random() * 9999 + 1)}/${Math.floor(Math.random() * 99 + 1)}`,
                ownerId: allLandowners[landownerIndex].id,
                areaAcres: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
                village: `Village ${Math.ceil(parcelNum / 50)}`,
                district: detailedProject.district,
                state: detailedProject.state,
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                            [0, 0], [1, 0], [1, 1], [0, 1], [0, 0]
                        ]]
                },
                acquisitionStatus: status,
                legalStatus: Math.random() > 0.9 ? client_2.LegalStatus.DISPUTE_PENDING : client_2.LegalStatus.NONE,
                rrStatus: status === client_2.AcquisitionStatus.COMPENSATION_PROCESSING ? client_2.RRStatus.PROCESSING :
                    Math.random() > 0.8 ? client_2.RRStatus.ELIGIBLE : client_2.RRStatus.NOT_ASSESSED
            });
        }
        underProcessIndex += count;
    }
    // Legal Dispute parcels (143)
    for (let i = 1; i <= 143; i++) {
        const parcelNum = 1356 + 421 + 143 + i;
        const landownerIndex = (parcelNum - 1) % allLandowners.length;
        parcelsToCreate.push({
            projectId: detailedProject.id,
            parcelCode: `NKIC-${String(parcelNum).padStart(4, '0')}`,
            surveyNumber: `SNO/${Math.floor(Math.random() * 9999 + 1)}/${Math.floor(Math.random() * 99 + 1)}`,
            ownerId: allLandowners[landownerIndex].id,
            areaAcres: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
            village: `Village ${Math.ceil(parcelNum / 50)}`,
            district: detailedProject.district,
            state: detailedProject.state,
            geometry: {
                type: "Polygon",
                coordinates: [[
                        [0, 0], [1, 0], [1, 1], [0, 1], [0, 0]
                    ]]
            },
            acquisitionStatus: client_2.AcquisitionStatus.LEGAL_DISPUTE,
            legalStatus: client_2.LegalStatus.DISPUTE_PENDING,
            rrStatus: client_2.RRStatus.NOT_ASSESSED
        });
    }
    // Not Started parcels (80)
    for (let i = 1; i <= 80; i++) {
        const parcelNum = 1356 + 421 + 143 + i;
        const landownerIndex = (parcelNum - 1) % allLandowners.length;
        parcelsToCreate.push({
            projectId: detailedProject.id,
            parcelCode: `NKIC-${String(parcelNum).padStart(4, '0')}`,
            surveyNumber: `SNO/${Math.floor(Math.random() * 9999 + 1)}/${Math.floor(Math.random() * 99 + 1)}`,
            ownerId: allLandowners[landownerIndex].id,
            areaAcres: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
            village: `Village ${Math.ceil(parcelNum / 50)}`,
            district: detailedProject.district,
            state: detailedProject.state,
            geometry: {
                type: "Polygon",
                coordinates: [[
                        [0, 0], [1, 0], [1, 1], [0, 1], [0, 0]
                    ]]
            },
            acquisitionStatus: client_2.AcquisitionStatus.NOT_STARTED,
            legalStatus: client_2.LegalStatus.NONE,
            rrStatus: client_2.RRStatus.NOT_ASSESSED
        });
    }
    // Shuffle the parcels to distribute them more realistically
    for (let i = parcelsToCreate.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [parcelsToCreate[i], parcelsToCreate[j]] = [parcelsToCreate[j], parcelsToCreate[i]];
    }
    // Create parcels in batches to avoid too many parameters
    const BATCH_SIZE = 100;
    for (let i = 0; i < parcelsToCreate.length; i += BATCH_SIZE) {
        const batch = parcelsToCreate.slice(i, i + BATCH_SIZE);
        await prisma.landParcel.createMany({ data: batch });
    }
    console.log(`Created 2000 land parcels`);
    // Get all parcels for creating related data
    const allParcels = await prisma.landParcel.findMany({
        where: { projectId: detailedProject.id }
    });
    // Create documents for parcels (let's say 2-3 documents per parcel on average)
    const documentTypes = [client_2.DocumentType.OWNERSHIP, client_2.DocumentType.SURVEY, client_2.DocumentType.NOTIFICATION, client_2.DocumentType.COMPENSATION, client_2.DocumentType.LEGAL, client_2.DocumentType.RR];
    const documentStatuses = [client_2.DocumentStatus.PENDING, client_2.DocumentStatus.VERIFIED, client_2.DocumentStatus.MISMATCH];
    const documentsToCreate = [];
    for (const parcel of allParcels) {
        // 2-4 documents per parcel
        const docCount = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < docCount; i++) {
            const typeIndex = Math.floor(Math.random() * documentTypes.length);
            const statusIndex = Math.floor(Math.random() * documentStatuses.length);
            // Cast to any to bypass strict TypeScript checking for Json fields
            documentsToCreate.push({
                parcelId: parcel.id,
                type: documentTypes[typeIndex],
                status: documentStatuses[statusIndex],
                extractedFields: statusIndex === 1 /* VERIFIED */ ? {
                    name: `Extracted Name ${Math.floor(Math.random() * 1000)}`,
                    area: parcel.areaAcres.toString(),
                    date: new Date().toISOString().split('T')[0]
                } : null,
                dbComparisonResult: statusIndex === 1 /* VERIFIED */ ? {
                    matches: Math.random() > 0.2,
                    mismatchedFields: Math.random() > 0.7 ? ['area', 'name'] : []
                } : null
            });
        }
    }
    // Create documents in batches
    for (let i = 0; i < documentsToCreate.length; i += BATCH_SIZE) {
        const batch = documentsToCreate.slice(i, i + BATCH_SIZE);
        await prisma.document.createMany({ data: batch });
    }
    console.log(`Created ${documentsToCreate.length} documents`);
    // Create compensation records for parcels (only for those with compensation status not NOT_ASSESSED)
    const compensationToCreate = [];
    for (const parcel of allParcels) {
        // Skip NOT_STARTED and some early stage parcels for compensation
        if (parcel.acquisitionStatus === client_2.AcquisitionStatus.NOT_STARTED ||
            parcel.acquisitionStatus === client_2.AcquisitionStatus.VERIFICATION ||
            parcel.acquisitionStatus === client_2.AcquisitionStatus.NOTIFICATION) {
            continue;
        }
        // Determine compensation status based on acquisition status
        let compStatus = client_2.CompensationStatus.NOT_ASSESSED;
        let paidAmount = 0;
        let assessedAmount = 0;
        switch (parcel.acquisitionStatus) {
            case client_2.AcquisitionStatus.ACQUIRED:
                compStatus = Math.random() > 0.3 ? client_2.CompensationStatus.FULLY_PAID : client_2.CompensationStatus.PARTIALLY_PAID;
                assessedAmount = parcel.areaAcres * 300000; // ₹3 lakhs per acre
                paidAmount = compStatus === client_2.CompensationStatus.FULLY_PAID ? assessedAmount : assessedAmount * 0.6;
                break;
            case client_2.AcquisitionStatus.POSSESSION:
                compStatus = client_2.CompensationStatus.PARTIALLY_PAID;
                assessedAmount = parcel.areaAcres * 280000;
                paidAmount = assessedAmount * 0.4;
                break;
            case client_2.AcquisitionStatus.COMPENSATION_PAID:
                compStatus = client_2.CompensationStatus.PARTIALLY_PAID;
                assessedAmount = parcel.areaAcres * 250000;
                paidAmount = assessedAmount * 0.3;
                break;
            case client_2.AcquisitionStatus.COMPENSATION_PROCESSING:
                compStatus = client_2.CompensationStatus.NOT_ASSESSED;
                assessedAmount = parcel.areaAcres * 220000;
                paidAmount = 0;
                break;
            default:
                compStatus = client_2.CompensationStatus.NOT_ASSESSED;
                assessedAmount = parcel.areaAcres * 200000;
                paidAmount = 0;
        }
        compensationToCreate.push({
            parcelId: parcel.id,
            assessedAmount: parseFloat(assessedAmount.toFixed(2)),
            paidAmount: parseFloat(paidAmount.toFixed(2)),
            status: compStatus
        });
    }
    // Create compensation in batches
    for (let i = 0; i < compensationToCreate.length; i += BATCH_SIZE) {
        const batch = compensationToCreate.slice(i, i + BATCH_SIZE);
        await prisma.compensation.createMany({ data: batch });
    }
    console.log(`Created ${compensationToCreate.length} compensation records`);
    // Create legal cases for parcels with LEGAL_DISPUTE status
    const legalCasesToCreate = [];
    const legalDisputeParcels = allParcels.filter(p => p.acquisitionStatus === client_2.AcquisitionStatus.LEGAL_DISPUTE);
    for (const parcel of legalDisputeParcels) {
        legalCasesToCreate.push({
            parcelId: parcel.id,
            caseId: `CASE-${String(Math.floor(Math.random() * 90000 + 10000)).padStart(5, '0')}`,
            issueType: Math.random() > 0.5 ? 'TITLE_DISPUTE' : 'BOUNDARY_DISPUTE',
            status: Math.random() > 0.7 ? client_2.LegalCaseStatus.CLOSED : client_2.LegalCaseStatus.OPEN,
            daysPending: Math.floor(Math.random() * 1000),
            responsibleDept: Math.random() > 0.5 ? 'Revenue Department' : 'Legal Affairs'
        });
    }
    // Create legal cases in batches
    for (let i = 0; i < legalCasesToCreate.length; i += BATCH_SIZE) {
        const batch = legalCasesToCreate.slice(i, i + BATCH_SIZE);
        await prisma.legalCase.createMany({ data: batch });
    }
    console.log(`Created ${legalCasesToCreate.length} legal cases`);
    // Create RR records for parcels (eligible for rehabilitation & resettlement)
    const rrRecordsToCreate = [];
    for (const parcel of allParcels) {
        // Only create RR records for parcels that are not NOT_STARTED and have some progress
        if (parcel.acquisitionStatus === client_2.AcquisitionStatus.NOT_STARTED) {
            continue;
        }
        // Determine eligibility based on area and status
        const isEligible = parcel.areaAcres > 0.5 &&
            parcel.acquisitionStatus !== client_2.AcquisitionStatus.VERIFICATION;
        if (isEligible) {
            rrRecordsToCreate.push({
                parcelId: parcel.id,
                familyId: `FAM-${String(Math.floor(Math.random() * 9000 + 1000)).padStart(4, '0')}`,
                status: Math.random() > 0.6 ? client_2.RRStatus.COMPLETED :
                    Math.random() > 0.3 ? client_2.RRStatus.PROCESSING :
                        Math.random() > 0.1 ? client_2.RRStatus.DOCS_PENDING : client_2.RRStatus.ELIGIBLE
            });
        }
    }
    // Create RR records in batches
    for (let i = 0; i < rrRecordsToCreate.length; i += BATCH_SIZE) {
        const batch = rrRecordsToCreate.slice(i, i + BATCH_SIZE);
        await prisma.rRRecord.createMany({ data: batch });
    }
    console.log(`Created ${rrRecordsToCreate.length} RR records`);
    // Create tasks for the project
    const tasksToCreate = [];
    const taskTypes = [
        client_2.TaskType.FIELD_VERIFICATION,
        client_2.TaskType.DOCUMENT_REVIEW,
        client_2.TaskType.COMPENSATION_CALCULATION,
        client_2.TaskType.LEGAL_PROCESSING,
        client_2.TaskType.RR_PROCESSING,
        client_2.TaskType.SITE_VISIT,
        client_2.TaskType.MEETING,
        client_2.TaskType.REPORT_GENERATION
    ];
    const priorities = [client_2.TaskPriority.LOW, client_2.TaskPriority.MEDIUM, client_2.TaskPriority.HIGH];
    // Create some sample tasks
    for (let i = 1; i <= 50; i++) {
        const taskTypeIndex = Math.floor(Math.random() * taskTypes.length);
        const priorityIndex = Math.floor(Math.random() * priorities.length);
        // Assign to different roles (responsibleRole is a String field)
        let responsibleRole = 'PROJECT_OFFICER';
        if (Math.random() > 0.7)
            responsibleRole = 'DISTRICT';
        if (Math.random() > 0.8)
            responsibleRole = 'STATE';
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
        });
    }
    // Create tasks in batches
    for (let i = 0; i < tasksToCreate.length; i += BATCH_SIZE) {
        const batch = tasksToCreate.slice(i, i + BATCH_SIZE);
        await prisma.task.createMany({ data: batch });
    }
    console.log(`Created ${tasksToCreate.length} tasks`);
    console.log('Seed completed successfully!');
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
