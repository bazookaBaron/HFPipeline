# "A million people, one door" (campfire, Leo + Walter, ~55 s final, voice at 1.3x)

Premise: Leo asks how a website survives a million people opening it at the same moment. Walter, his grandfather, explains the load balancer in plain words (the classic interview question: scale a service past one machine). Both stay seated by the fire the whole time. The restaurant, the host, the servers and the doors exist only in words and in the MG.
Payload: (1) one computer can only serve so many people at a time, so a big site is hundreds of identical copies on hundreds of machines; (2) a visitor only knocks on one door: the load balancer, a host standing in front of them all; (3) he points each new visitor to a server: in turn (round robin) or to the least busy one; (4) he checks every server every few seconds and stops sending people to a dead one, so nobody notices; (5) the host himself is then the weak spot, so there are two of them.
Human question: "If everyone shows up at once, why isn't it chaos?" Turn: Leo spots that the host itself is the thing that cannot fail. Landing: who points to the hosts? Hosts all the way up.
Running line: "points" (L8 "He points.", L16 "who points people to the hosts", L18 "hosts all the way up").

LEO (curious) [CU]: Grandpa, a million people open the same website at once. Why doesn't it die?
WALTER (amused) [MS]: One computer would. Instantly.
LEO (surprised) [OTS]: So it's not one computer?
WALTER (matter-of-fact) [MS]: Hundreds. All running the same copy of the site.
LEO (confused) [OTS]: But my phone only knocks on one door.
WALTER (warm) [MS]: Yes. A man stands at that door. Like the host at a busy restaurant.
LEO (curious) [OTS]: What does he do?
WALTER (matter-of-fact) [MS]: He points. You, table one. You, table two. Round and round.
LEO (thinking) [OTS]: And if table two is slow?
WALTER (pleased) [MS]: Then the next guest goes to the emptiest table. He keeps count.
LEO (curious) [OTS]: What if a table just breaks?
WALTER (matter-of-fact) [2S]: He checks every few seconds. A broken one gets no guests. Nobody notices.
LEO (shocked) [CU]: Wait. So the host is the one thing that can't break?
WALTER (pleased) [MS]: Good catch. So there are two of them.
LEO (confused) [OTS]: Two hosts. Then who points people to the hosts?
WALTER (firm, light) [MS]: Another list. That one is public.
LEO (grinning) [CU]: And who checks that one?
WALTER (dry, flat) [CU]: Don't. It's hosts all the way up.

#end

Delivery notes (voice): normal conversational pace (the track is sped up 1.3x after, pitch kept). Leo: curious, surprised, a playful "Wait." at the turn (L13), a grin on the last question. Walter: warm, smiling in the voice, falls to a low finish; only the last line is dry and flat, after a beat.
Seated: no actions at all. Nobody stands at a door or points; the host, the tables and the servers are words + MG only.

<!-- Sources (plain terms)
- A single server can only handle a limited number of simultaneous connections/requests, so large sites scale horizontally across many identical servers behind a load balancer: AWS Well-Architected, Reliability Pillar ("horizontal scaling"); NGINX docs "HTTP Load Balancing"; Cloudflare Learning Center "What is load balancing?".
- Clients connect to one address (the load balancer), which forwards each new request to one of the backend servers: NGINX docs; HAProxy docs "Introduction"; AWS Elastic Load Balancing user guide.
- Round robin sends requests to the servers in turn; least-connections sends the next request to the server with the fewest active connections: NGINX docs ("round-robin", "least_conn"); HAProxy "balance" algorithms.
- Health checks: the balancer probes each backend every few seconds and stops routing to one that fails: AWS ELB "Health checks for your target groups" (default interval 30 s, configurable down to 5 s); NGINX "Active health checks"; HAProxy "check".
- The load balancer is itself a single point of failure unless it is redundant, so they run in pairs/groups (active-passive or active-active; e.g. keepalived/VRRP, or managed balancers spread over several zones): HAProxy / keepalived docs; AWS ELB "Availability Zones".
- Clients find the balancers through public DNS (a list of addresses; DNS itself is served by many redundant servers): RFC 1034; Cloudflare "What is DNS?". "Hosts all the way up" is a joke on the infinite-regress; DNS is the real top of the chain.
- "A million people at once" is Leo's framing; real big sites spread across many machines and regions.
-->
