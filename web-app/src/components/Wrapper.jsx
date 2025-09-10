import { useEffect } from "react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import './Wrapper.css'

function Wrapper({ children }) {
    const navigate = useNavigate();
    const [isLogIn,] = useState(false)
    const [isShow, setIsShow] = useState(true)

    useEffect(() => {
        if(!isLogIn) {
            navigate('/login')
        }
    })

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsShow(false);
        }, 3000);
        return () => clearTimeout(timer);
    }, [])

    return (
        <div>
            { isShow ? <div className="popup"></div> : <></> }
            { children }
        </div>
    )
}

export default Wrapper