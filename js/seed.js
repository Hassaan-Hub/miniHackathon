import { db, auth } from '/js/firebase-config.js';
import { collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showToast } from '/js/utils.js';

let currentUser = null;
let userOrgId = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const status = document.getElementById('status');
    if (status) status.innerHTML = '<p class="text-red-600 text-center">Please <a href="/login.html" class="text-blue-600">login</a> first.</p>';
    return;
  }
  currentUser = user;

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      userOrgId = userDoc.data().orgId;
      const status = document.getElementById('status');
      if (status) status.innerHTML = `<p class="text-green-600 text-center">Logged in. Org: ${userOrgId.substring(0, 8)}...</p>`;
    } else {
      const status = document.getElementById('status');
      if (status) status.innerHTML = '<p class="text-red-600 text-center">User profile not found.</p>';
    }
  } catch (err) {
    console.error('[seed] Failed to load user profile:', err);
    const status = document.getElementById('status');
    if (status) status.innerHTML = `<p class="text-red-600 text-center">Error: ${err.message}</p>`;
  }
});

const seedBtn = document.getElementById('seedBtn');
if (seedBtn) {
  seedBtn.addEventListener('click', async () => {
    if (!currentUser || !userOrgId) {
      showToast('Please login first', 'error');
      return;
    }

    const btn = document.getElementById('seedBtn');
    btn.disabled = true;
    btn.textContent = 'Seeding...';

    const status = document.getElementById('status');
    const log = (msg) => { if (status) status.innerHTML += `<p class="text-xs text-slate-500">${msg}</p>`; };

    try {
      log('Creating technician accounts...');
      const techNames = [
        { name: 'Ahmed Khan', email: 'ahmed@demo.com' },
        { name: 'Sara Malik', email: 'sara@demo.com' },
        { name: 'Hassan Ali', email: 'hassan@demo.com' },
        { name: 'Fatima Noor', email: 'fatima@demo.com' }
      ];

      const techIds = [];
      for (const tech of techNames) {
        const ref = await addDoc(collection(db, 'users'), {
          orgId: userOrgId,
          name: tech.name,
          email: tech.email,
          role: 'technician',
          phone: '+92 300 ' + Math.floor(1000000 + Math.random() * 9000000),
          emailVerified: true,
          createdAt: serverTimestamp()
        });
        techIds.push(ref.id);
        log(`  Created: ${tech.name}`);
      }

      log('Creating assets...');
      const assetData = [
        { name: 'AC Unit - Room 204', category: 'HVAC', location: 'Main Building, 2nd Floor, Room 204', status: 'operational' },
        { name: 'Elevator A', category: 'Electrical', location: 'Main Building, Ground Floor', status: 'operational' },
        { name: 'Generator - Backup', category: 'Electrical', location: 'Utility Area, Ground Floor', status: 'operational' },
        { name: 'Projector - Conference Hall', category: 'IT Equipment', location: 'Admin Block, 3rd Floor', status: 'operational' },
        { name: 'Water Pump - Main', category: 'Plumbing', location: 'Basement Level B1', status: 'under_maintenance' },
        { name: 'Fire Extinguisher - Zone A', category: 'Safety', location: 'Main Building, 1st Floor', status: 'operational' },
        { name: 'Server Room AC', category: 'HVAC', location: 'IT Block, Basement', status: 'operational' },
        { name: 'Parking Gate Barrier', category: 'Electrical', location: 'Main Entrance', status: 'operational' },
        { name: 'Cafeteria Oven', category: 'Kitchen', location: 'Cafeteria, Ground Floor', status: 'operational' },
        { name: 'MRI Machine', category: 'Medical', location: 'Hospital Wing, Room 101', status: 'operational' },
        { name: 'AC Unit - Room 105', category: 'HVAC', location: 'Main Building, 1st Floor, Room 105', status: 'out_of_service' },
        { name: 'Sprinkler System', category: 'Plumbing', location: 'Garden Area', status: 'operational' },
      ];

      const assetIds = [];
      for (const a of assetData) {
        const ref = await addDoc(collection(db, 'assets'), {
          orgId: userOrgId,
          ...a,
          installDate: '2023-' + String(Math.floor(1 + Math.random() * 12)).padStart(2, '0') + '-' + String(Math.floor(1 + Math.random() * 28)).padStart(2, '0'),
          warrantyExpiry: '2026-' + String(Math.floor(1 + Math.random() * 12)).padStart(2, '0') + '-' + String(Math.floor(1 + Math.random() * 28)).padStart(2, '0'),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        assetIds.push(ref.id);
        log(`  Created: ${a.name}`);
      }

      log('Creating sample issues...');
      const issueTemplates = [
        { desc: 'AC not cooling properly, room temperature above 28°C', urgency: 'high', status: 'reported' },
        { desc: 'Elevator making unusual grinding noise between floors 2-3', urgency: 'critical', status: 'triaged' },
        { desc: 'Generator oil leak detected near the base', urgency: 'high', status: 'assigned' },
        { desc: 'Projector display flickering, lamp may need replacement', urgency: 'medium', status: 'in_progress' },
        { desc: 'Water pump making loud humming noise, low water pressure', urgency: 'high', status: 'resolved' },
        { desc: 'AC unit dripping water onto desk below', urgency: 'medium', status: 'reported' },
        { desc: 'Server room temperature rising above threshold', urgency: 'critical', status: 'assigned' },
        { desc: 'Gate barrier slow to respond to remote', urgency: 'low', status: 'triaged' },
        { desc: 'Oven thermostat not maintaining correct temperature', urgency: 'medium', status: 'in_progress' },
        { desc: 'MRI machine calibration drift detected', urgency: 'critical', status: 'reported' },
        { desc: 'AC unit complete failure, no cooling at all', urgency: 'critical', status: 'reported' },
        { desc: 'Sprinkler head leaking in zone 3', urgency: 'medium', status: 'triaged' },
      ];

      const reporters = ['Ali Raza', 'Zainab Hussain', 'Omar Farooq', 'Ayesha Siddiqui', 'Public User'];

      for (let i = 0; i < issueTemplates.length; i++) {
        const t = issueTemplates[i];
        const assetIndex = i % assetIds.length;
        const techIndex = i % techIds.length;

        const ref = await addDoc(collection(db, 'issues'), {
          assetId: assetIds[assetIndex],
          orgId: userOrgId,
          description: t.desc,
          category: assetData[assetIndex].category,
          urgency: t.urgency,
          status: t.status,
          reportedBy: reporters[i % reporters.length],
          reporterName: reporters[i % reporters.length],
          assignedTo: ['assigned', 'in_progress', 'resolved', 'closed'].includes(t.status) ? techIds[techIndex] : null,
          photos: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          triageNotes: t.status !== 'reported' ? 'Triaged and categorized for follow-up.' : null,
          resolvedAt: ['resolved', 'closed'].includes(t.status) ? serverTimestamp() : null,
          resolutionNotes: t.status === 'resolved' ? 'Issue has been addressed. Replaced faulty component.' : null,
          cost: t.status === 'resolved' ? Math.floor(50 + Math.random() * 500) : null
        });

        await addDoc(collection(db, 'serviceHistory'), {
          assetId: assetIds[assetIndex],
          orgId: userOrgId,
          issueId: ref.id,
          action: 'reported',
          performedBy: reporters[i % reporters.length],
          notes: t.desc.substring(0, 80),
          timestamp: serverTimestamp()
        });

        log(`  Created issue: ${t.desc.substring(0, 40)}...`);
      }

      log('');
      log('Demo data seeded successfully!');
      showToast('Demo data created!', 'success');

    } catch (err) {
      console.error('[seed] Error:', err);
      log('Error: ' + err.message);
      showToast('Error seeding data', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Seed More Data';
  });
}
