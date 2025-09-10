import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import bcrypt from "bcryptjs";

// Your Firebase config — use your collector project config here
const firebaseConfig = {
  apiKey: "AIzaSyBmyCLCMS0H6UnsUbrTgi0dv7p1aat6k_w",
  authDomain: "ikolek-ba6d1.firebaseapp.com",
  projectId: "ikolek-ba6d1",
  storageBucket: "ikolek-ba6d1.firebasestorage.app",
  messagingSenderId: "574522796555",
  appId: "1:574522796555:web:44b03cf6d191c26026f50e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const saltRounds = 10;

function hashPassword(plainPassword) {
  const salt = bcrypt.genSaltSync(saltRounds);
  return bcrypt.hashSync(plainPassword, salt);
}

async function migratePasswords() {
  const driversSnapshot = await getDocs(collection(db, "drivers"));

  for (const driverDoc of driversSnapshot.docs) {
    const data = driverDoc.data();
    const plainPassword = data.password;

    // Check if password is probably plaintext by length (bcrypt hashes are ~60 chars)
    if (plainPassword && plainPassword.length < 60) {
      const hashedPass = hashPassword(plainPassword);
      const driverRef = doc(db, "drivers", driverDoc.id);

      await updateDoc(driverRef, { password: hashedPass });
      console.log(`Password migrated for driver ${driverDoc.id}`);
    } else {
      console.log(`Skipping driver ${driverDoc.id}, password already hashed`);
    }
  }

  console.log("Password migration completed.");
}

migratePasswords().catch(console.error);
