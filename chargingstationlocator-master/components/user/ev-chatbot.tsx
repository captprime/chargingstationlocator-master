'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, User } from 'lucide-react';
import { ChargingStation } from '@/types/station';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'bot';
  text: string;
}

interface EVChatbotProps {
  stations?: ChargingStation[];
  batteryPercentage?: number;
  userLocation?: { latitude: number; longitude: number };
}

function generateResponse(input: string, stations: ChargingStation[], battery: number, location?: { latitude: number; longitude: number }): string {
  const q = input.toLowerCase();

  if (q.includes('cheapest') || q.includes('cheap') || q.includes('price') || q.includes('cost')) {
    if (stations.length === 0) return "I don't see any nearby stations loaded yet. Try refreshing the stations list.";
    const cheapest = [...stations].sort((a, b) => a.pricePerKwh - b.pricePerKwh)[0];
    return `The cheapest nearby station is ${cheapest.name} at ₹${cheapest.pricePerKwh}/kWh (${cheapest.distance?.toFixed(1)} km away).`;
  }

  if (q.includes('nearest') || q.includes('closest') || q.includes('near me') || q.includes('best station')) {
    if (stations.length === 0) return "No stations loaded yet. Please allow location access and refresh.";
    const nearest = [...stations].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0];
    return `The nearest station is ${nearest.name}, just ${nearest.distance?.toFixed(1)} km away. Queue: ${nearest.queueLength} waiting, Price: ₹${nearest.pricePerKwh}/kWh.`;
  }

  if (q.includes('queue') || q.includes('wait') || q.includes('busy')) {
    if (stations.length === 0) return "No stations loaded yet.";
    const leastQueue = [...stations].sort((a, b) => a.queueLength - b.queueLength)[0];
    return `${leastQueue.name} has the shortest queue with ${leastQueue.queueLength} people waiting (${leastQueue.distance?.toFixed(1)} km away).`;
  }

  if (q.includes('battery') || q.includes('charge') || q.includes('percentage') || q.includes('%')) {
    if (battery <= 15) return `Your battery is critically low at ${battery}%. Please charge immediately! I recommend heading to the nearest station right away.`;
    if (battery <= 30) return `Your battery is at ${battery}% — getting low. You should plan to charge soon. The nearest station is ${stations[0]?.name ?? 'nearby'}.`;
    return `Your battery is at ${battery}%. You have roughly ${Math.round(battery * 2)} km of range remaining. No immediate action needed.`;
  }

  if (q.includes('noida') || q.includes('delhi') || q.includes('reach') || q.includes('range')) {
    const rangeKm = battery * 2;
    return `With ${battery}% battery, your estimated range is ~${rangeKm} km. If your destination is within that range, you're good to go. Otherwise, I'd suggest stopping at a nearby station first.`;
  }

  if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
    return `Hi! I'm your EV assistant. Ask me about nearby stations, battery range, cheapest chargers, or queue times.`;
  }

  if (q.includes('help') || q.includes('what can you')) {
    return `I can help you with:\n• Best station near me\n• Cheapest charger\n• Shortest queue\n• Battery range estimate\n• Can I reach [destination]?`;
  }

  return `I'm not sure about that. Try asking: "Best station near me", "Cheapest charger", "How much range do I have?", or "Which station has the shortest queue?"`;
}

export function EVChatbot({ stations = [], batteryPercentage = 80, userLocation }: EVChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Hi! I\'m your EV assistant. Ask me about nearby stations, battery range, or charging costs.' }
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(1); // start at 1 (initial bot message)

  // Only scroll when new messages are added, not on initial mount
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevLengthRef.current = messages.length;
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: Message = { role: 'user', text: trimmed };
    const botResponse = generateResponse(trimmed, stations, batteryPercentage, userLocation);
    const botMsg: Message = { role: 'bot', text: botResponse };

    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
  };

  const suggestions = ['Best station near me', 'Cheapest charger', 'Shortest queue', 'My battery range'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          EV Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Chat window */}
        <div className="h-64 overflow-y-auto space-y-3 pr-1">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'bot' && (
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3 w-3 text-blue-600" />
                </div>
              )}
              <div className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              )}>
                {msg.text}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-1">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setInput(s); }}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full px-2 py-1 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Ask me anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
