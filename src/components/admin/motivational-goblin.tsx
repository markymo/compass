"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

const QUOTES = [
    // User Favorites
    "Conquer the day, you magnificent disaster!",
    "Rise and Grind, motherfucker.",
    "Stay Alert, your country needs Lerts.",

    // Movies & TV
    "Looks like someone has a case of the Mondays.",
    "I believe you have my stapler.",
    "So you're telling me there's a chance.",
    "That rug really tied the room together.",
    "This is not 'Nam. This is bowling. There are rules.",
    "Yeah, well, that's just, like, your opinion, man.",
    "It's just a flesh wound.",
    "I fart in your general direction!",
    "Do or do not. There is no try.",
    "Roads? Where we're going, we don't need roads.",
    "Great Scott!",
    "Life moves pretty fast. If you don't stop and look around once in a while, you could miss it.",
    "Show me the money!",
    "You can't handle the truth!",
    "Go ahead, make my day.",
    "Yippee-ki-yay, motherfucker.",
    "Hasta la vista, baby.",
    "I'll be back.",
    "Nobody puts Baby in a corner.",
    "There's no crying in baseball!",
    "You're gonna need a bigger boat.",
    "Here's looking at you, kid.",
    "Frankly, my dear, I don't give a damn.",
    "I see dead people.",
    "Houston, we have a problem.",
    "What we've got here is failure to communicate.",
    "I'm as mad as hell, and I'm not going to take this anymore!",
    "Greed, for lack of a better word, is good.",
    "Keep your friends close, but your enemies closer.",
    "The first rule of Fight Club is: You do not talk about Fight Club.",
    "Why so serious?",
    "May the Force be with you.",
    "Live long and prosper.",
    "Resistance is futile.",
    "Make it so.",
    "Winter is coming.",
    "I drink and I know things.",
    "Chaos is a ladder.",
    "Just keep swimming.",
    "To infinity and beyond!",
    "Hakuna Matata.",
    "My precious.",
    "You have failed this city.",
    "This is the way.",
    "Help me, Obi-Wan Kenobi. You're my only hope.",
    "I am your father.",
    "E.T. phone home.",
    "Phone home? I have a smartphone.",
    "Get to the chopper!",
    "Put the bunny back in the box.",
    "Not the bees! NOT THE BEES!",
    "I'm King of the World!",
    "King Kong ain't got shit on me!",
    "Say hello to my little friend!",
    "You talkin' to me?",
    "Are you not entertained?",
    "They may take our lives, but they'll never take our freedom!",
    "For Frodo."
]

export function MotivationalGoblin({ className }: { className?: string }) {
    const [quote, setQuote] = useState("")
    const [isSpinning, setIsSpinning] = useState(false)

    const refreshQuote = () => {
        setIsSpinning(true)
        // Pick a random quote distinct from the current one if possible
        let newQuote
        do {
            newQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)]
        } while (newQuote === quote && QUOTES.length > 1)

        setQuote(newQuote)
        setTimeout(() => setIsSpinning(false), 500)
    }

    useEffect(() => {
        // Initial hydration
        setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)])
    }, [])

    if (!quote) return null // Avoid hydration mismatch flicker

    return (
        <div className={cn("flex items-center gap-2 text-slate-500 text-sm italic", className)}>
            <span>“{quote}”</span>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-indigo-600"
                onClick={refreshQuote}
            >
                <RefreshCw className={cn("h-3 w-3", isSpinning && "animate-spin")} />
            </Button>
        </div>
    )
}
