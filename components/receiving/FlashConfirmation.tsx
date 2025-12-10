"use client"

import { useEffect, useState } from "react"
import { CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface FlashConfirmationProps {
  show: boolean
  lotNumber?: string
  onComplete?: () => void
}

export function FlashConfirmation({
  show,
  lotNumber,
  onComplete,
}: FlashConfirmationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)

      // Play success sound
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGi77OahUBELTKXh8bllHAU2jdXxxn0pBSp+zPDajzsKFGCz6OyrWBQLSKDf8sFuJAUug9Hx2Ik3CBlpu+znoVARDEun4PG3YhwGN5HX8sx6LQUkdcbw3ZBACxVhtejrqVYTC0ie3vLBbiMFLoTR8dqKOAgZarvs56FQEAxLp+DxtmIcBjaR1/LNei0FJHbG8N2RQQsVYrXo66pXFAtHnN7ywW4jBS+E0fHaijgIGWq77OiiUBENS6jg8LdiHAY3kdfyzHotBSR2xvDdkUELFWK16OuqVxQLR5ze8sFuIwUvhNHx2oo4CBlqu+znolARDUup4PC3YhwFOJHX8sx5LQUkdsbw3ZFCCxVitejsqlcTDEed3vK/bSMFL4TR8duKOQcZarvs56FREAxLqODwtmIcBjiR1/LNei4FJHbG8N+RQQsVY7Xo7KpXEwxHnd7yv24jBS+F0fHaijkHGWm77OihUBEMS6jg8LdjHAU4ktjyzXkuBSR2x/DfkUELFWO16OyrVxMMSJ3e8r9uIwUvhdHx2oo5Bxlpu+zooVARDEyo4PC3YhwFOI/Y8s15LgUld8fw35FBCxVjtejsq1cTDEed3vK/bSQFL4TR8dqKOQcZabvs6KFQEQxMqODwt2IcBTiP2PLNeS4FJXfH8N+RQQsVY7Xo7KtXEwxHnd7yv20kBS+E0fHaijkHGWm77OihUBEMTKjg8LdiHAU4j9jyzXkuBSV3x/DfkUELFWO16OyrVxMMR53e8r9tJAUvhNHx2oo5Bxlpu+zooVARDEyo4PC3YhwFOI/Y8s15LgUld8fw35FBCxVjtejsq1cTDEed3vK/bSQFL4TR8dqKOQcZabvs6KFQEQxMqODwt2IcBTiP2PLNeS4FJXfH8N+RQQsVY7Xo7KtXEwxHnd7yv20kBS+E0fHaijkHGWm77OihUBEMTKjg8LdiHAU4j9jyzXkuBSV3x/DfkUELFWO16OyrVxMMR53e8r9tJAUvhNHx2oo5Bxlpu+zooVARDEyo4PC3YhwFOI/Y8s15LgUld8fw35FBCxVjtejsq1cTDEed3vK/bSQFL4TR8dqKOQcZabvs6KFQEQxMqODwt2IcBTiP2PLNeS4FJXfH8N+RQQsVY7Xo7KtXEwxHnd7yv20kBS+E0fHaijkHGWm77OihUBEMTKjg8LdiHAU4j9jyzXkuBSV3x/DfkUELFWO16OyrVxMMR53e8r9tJAUvhNHx2oo5Bxlpu+zooVARDEyo4PC3YhwFOI/Y8s15LgUld8fw35FBCxVjtejsq1cTDEed3vK/bSQFL4TR8dqKOQcZabvs6KFQEQxMqODwt2IcBTiP2PLNeS4FJXfH8N+RQQsVY7Xo7KtXEwxHnd7yv20kBS+E0fHaijkHGWm77OihUBEMTKjg8LdiHAU4j9jyzXkuBSV3x/DfkUELFWO16OyrVxMMR53e8r9tJAUvhNHx2oo5Bxlpu+zooVARDEyo4PC3YhwFOI/Y8s15LgUld8fw35FBCxVjtejsq1cTDEed3vK/bSQFL4TR8dqKOQcZabvs6KFQEQxMqODwt2IcBTiP2PLNeS4FJXfH8N+RQQ=")
        audio.play().catch(() => {}) // Ignore errors if audio fails
      } catch (e) {
        // Ignore audio errors
      }

      // Auto-hide after 0.8 seconds (shorter for better UX)
      const timer = setTimeout(() => {
        setIsVisible(false)
        if (onComplete) {
          setTimeout(onComplete, 200) // Wait for fade out animation
        }
      }, 800)

      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!show && !isVisible) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-green-600 transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="text-center text-white">
        <CheckCircle className="h-48 w-48 mx-auto mb-8 animate-bounce" strokeWidth={3} />
        <h1 className="text-6xl font-bold mb-4">RECEIVED</h1>
        {lotNumber && (
          <p className="text-4xl font-semibold">LOT #{lotNumber}</p>
        )}
      </div>
    </div>
  )
}

