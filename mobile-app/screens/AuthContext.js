// AuthContext.js
import React, { createContext, useState } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [collectorId, setCollectorId] = useState(null);
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  return (
    <AuthContext.Provider value={{ collectorId, setCollectorId, isLoggedOut, setIsLoggedOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
