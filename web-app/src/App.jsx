import './App.css';
import logo from './assets/wasteui.jpeg';
import bg from './assets/bg.jpg';
import { useEffect, useState } from 'react';
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { MdOutlineEmail } from "react-icons/md";
import { TbLockPassword } from "react-icons/tb";
import { db } from "./firebase/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
// ADDED
import { getAuth } from "firebase/auth";

function RenderLoginForm({ email, setEmail, password, setPassword, showPassword, setShowPassword, loading, onLogin, setErrorMessage, errorMessage, setLoading}) {
	
  const navigate = useNavigate()
  const auth = getAuth()
  const handleLogin = async () => {
		setErrorMessage("");
	
		if (!email || !password) {
			setErrorMessage("Please enter email and password.");
			return;
		}
	
		if (!validateEmail(email)) {
			setErrorMessage("Please enter a valid email address.");
			return;
		}
	
		setLoading(true);
		try {
			const userCredential = await signInWithEmailAndPassword(auth, email, password);
			const user = userCredential.user;
	
			const userDoc = await getDoc(doc(db, "admin", user.uid));
      console.log(userDoc.data());
			if (userDoc.exists() && userDoc.data().role === "admin") {
				navigate("/dashboard", { replace: true });
			} else {
				setErrorMessage("Access Denied! Admins only.");
			}
		} catch (error) {
			console.error(error);
			setErrorMessage("Login failed: " + error.message);
		} finally {
			setLoading(false);
		}
	};

	const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  return (
    <div className={`loginForm${onLogin ? " expanded" : ""}`}>
      <div className='input'>
				<MdOutlineEmail style={{
					position: "absolute", top: "5px", left: "5px"
				}}/>
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className='input'>
				<TbLockPassword style={{
					position: "absolute", top: "5px", left: "5px"
				}}/>
        <input
          placeholder="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          onClick={() => setShowPassword(!showPassword)}
          type="button"
          aria-label="Toggle password visibility"
        >
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>
      <button className="loginBtn" onClick={handleLogin} disabled={loading}>
        {loading ? "Logging In..." : "Login"}
      </button>
			<div className='errorMessage'>
				{errorMessage? <p>{errorMessage}</p> : <></>}
			</div>
    </div>
  );
}

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [onLogin, setOnLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
  const { search } = useLocation();

  useEffect(() => {
  const queryParams = new URLSearchParams(search);
  setErrorMessage(queryParams.get("error"));
  if (queryParams.get("error") != null) {
    setOnLogin(true);
  }
}, [search]); 


  return (
    <div className="wrapper">
      <div>
        <div>
          <img src={logo} alt="Logo" />
          <h1>iKOLEK</h1>
            <RenderLoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loading={loading}
							onLogin={onLogin}
							setErrorMessage={setErrorMessage}
							errorMessage={errorMessage}
							setLoading={setLoading}
            />
          <button
            className="get-started"
            onClick={() => setOnLogin(!onLogin)}
          >
            {onLogin ? "Hide" : "Get Started"}
          </button>
        </div>
      </div>

      <div style={{ backgroundImage: `url(${bg})` }}>
        <div className="overlay" />
        <div className="content">
          <h1 className="title">Welcome!</h1>
          <p className="subtitle">Waste Routing Management System</p>
        </div>
      </div>
    </div>
  );
}

export default App;
