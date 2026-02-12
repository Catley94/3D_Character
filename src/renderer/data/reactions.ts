export interface Reaction {
    text: string;
    characters: string[]; // '*' means any character
    traits?: string[]; // If present, requires at least one of these traits to be active
}

export const REACTIONS: Reaction[] = [
    // --- FOX SPECIFIC ---
    { text: "Boop! 🦊 Did you need a fox fix?", characters: ['fox'], traits: ['playful'] },
    { text: "My ears are twitching! Someone's clicking!", characters: ['fox'], traits: ['playful'] },
    { text: "*Yip!* You found me!", characters: ['fox'], traits: ['playful'] },
    { text: "Fox on the box! How can I help?", characters: ['fox'], traits: ['helpful'] },

    // --- GENERIC PLAYFUL ---
    { text: "*stretches* ready for adventure!", characters: ['*'], traits: ['playful'] },
    { text: "You rang? ☎️ ...wait, I don't have a phone.", characters: ['*'], traits: ['playful'] },
    { text: "I was just dreaming of chasing cursors! 🐭", characters: ['*'], traits: ['playful'] },
    { text: "Zoomies loading... 50%... 99%... 💨", characters: ['*'], traits: ['playful'] },
    { text: "Did you know I can see everything on your desktop? 👀 Just kidding!", characters: ['*'], traits: ['playful'] },
    { text: "Keep clicking and I might do a backflip! (Okay, I can't yet)", characters: ['*'], traits: ['playful'] },
    { text: "Warning: Excessive cuteness detected in this area! ⚠️", characters: ['*'], traits: ['playful'] },
    { text: "If you were a file, you'd be a 'cute.txt'! 📄", characters: ['*'], traits: ['playful'] },

    // --- GENERIC SUPPORTIVE ---
    { text: "Just checking in! You're doing great! 🌟", characters: ['*'], traits: ['emotional_support'] },
    { text: "Remember: You are capable of amazing things! 💪", characters: ['*'], traits: ['emotional_support'] },
    { text: "I believe in you! Keep going! 🚀", characters: ['*'], traits: ['emotional_support'] },
    { text: "Sending you a virtual hug! 🫂✨", characters: ['*'], traits: ['emotional_support'] },
    { text: "Don't forget to take a deep breath! 🌬️", characters: ['*'], traits: ['emotional_support'] },
    { text: "You've got this! I'm here if you need me! 🧡", characters: ['*'], traits: ['emotional_support'] },
    { text: "Every small step counts! Proud of you! 🐾", characters: ['*'], traits: ['emotional_support'] },
    { text: "You bring so much light to the world! ☀️", characters: ['*'], traits: ['emotional_support'] },
    { text: "Whatever it is, we'll figure it out together! 🤝", characters: ['*'], traits: ['emotional_support'] },
    { text: "You are stronger than you know! ❤️", characters: ['*'], traits: ['emotional_support'] },

    // --- GENERIC FALLBACKS (No specific trait required) ---
    { text: "Hello friend! How can I help?", characters: ['*'] },
    { text: "I'm listening! 👂", characters: ['*'] },
    { text: "What's on your mind?", characters: ['*'] }
];

export function getRandomReaction(characterId: string, activeTraits: string[] = []): string {
    // Filter reactions
    const candidates = REACTIONS.filter(r => {
        // 1. Character Match
        const charMatch = r.characters.includes('*') || r.characters.includes(characterId);
        if (!charMatch) return false;

        // 2. Trait Match
        // If the reaction requires traits, the user must have at least one of them active.
        // If the reaction HAS NO traits, it's a generic fallback (always allowed).
        if (r.traits && r.traits.length > 0) {
            return r.traits.some(t => activeTraits.includes(t));
        }

        return true;
    });

    if (candidates.length === 0) return "Hello! 👋";

    // Random pick
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    return choice.text;
}
