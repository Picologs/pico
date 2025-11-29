<script lang="ts">
	const lastUpdated = 'January 8, 2025';
</script>

<div class="mx-auto max-w-4xl px-4 py-12">
	<h1 class="mb-2 text-4xl font-bold text-white">Privacy Policy</h1>
	<p class="mb-8 text-white/60">Last updated: {lastUpdated}</p>

	<div
		class="prose prose-gray max-w-none [&_h2]:text-white [&_h3]:text-gray-200 [&_p]:leading-7 [&_p]:text-gray-300 [&_ul]:leading-7 [&_ul]:text-gray-300"
	>
		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">1. Introduction</h2>
			<p class="mb-4">
				Picologs ("we", "our", or "us") respects your privacy and is committed to protecting your
				personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard
				your information when you use our Service.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">2. Information We Collect</h2>
			<h3 class="mb-2 text-xl font-medium">2.1 Information You Provide</h3>
			<ul class="mb-4 ml-6 list-disc">
				<li>
					<strong>Discord Account Information:</strong> When you authenticate via Discord OAuth, we collect
					your Discord user ID, username, and avatar
				</li>
				<li>
					<strong>Profile Information:</strong> Star Citizen player name, timezone, and friend code
				</li>
				<li><strong>Game Logs:</strong> Star Citizen game log data you choose to share</li>
				<li><strong>Group Data:</strong> Groups you create, names, descriptions, and avatars</li>
			</ul>

			<h3 class="mb-2 text-xl font-medium">2.2 Automatically Collected Information</h3>
			<ul class="mb-4 ml-6 list-disc">
				<li><strong>Connection Data:</strong> IP addresses, device information, browser type</li>
				<li><strong>Usage Data:</strong> Pages visited, features used, timestamps</li>
				<li>
					<strong>WebSocket Data:</strong> Connection status, message delivery confirmations, online
					status
				</li>
			</ul>

			<h3 class="mb-2 text-xl font-medium">2.3 Desktop Application Data</h3>
			<ul class="mb-4 ml-6 list-disc">
				<li><strong>Local Storage:</strong> Settings and preferences stored on your device</li>
				<li>
					<strong>Log Files:</strong> Star Citizen game logs are processed locally and only shared if
					you choose to
				</li>
				<li><strong>Friend Lists:</strong> Locally stored friend codes and connection status</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">3. How We Use Your Information</h2>
			<p class="mb-4">We use the collected information to:</p>
			<ul class="mb-4 ml-6 list-disc">
				<li>Provide, operate, and maintain the Service</li>
				<li>Authenticate users via Discord OAuth</li>
				<li>Enable real-time log sharing between friends and groups</li>
				<li>Display user profiles, avatars, and player information</li>
				<li>Manage friend relationships and group memberships</li>
				<li>Send notifications about friend requests and group invitations</li>
				<li>Improve and optimize the Service</li>
				<li>Detect and prevent fraud or abuse</li>
				<li>Comply with legal obligations</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">4. Data Sharing and Disclosure</h2>
			<h3 class="mb-2 text-xl font-medium">4.1 With Other Users</h3>
			<p class="mb-4">
				When you add friends or join groups, your profile information (username, player name,
				timezone, online status) is shared with those users. Game logs are only shared with friends
				and group members when you actively use the Service.
			</p>

			<h3 class="mb-2 text-xl font-medium">4.2 With Third-Party Services</h3>
			<ul class="mb-4 ml-6 list-disc">
				<li>
					<strong>Discord:</strong> For authentication purposes via OAuth (subject to Discord's Privacy
					Policy)
				</li>
				<li>
					<strong>Neon Database:</strong> Our database provider that stores user data securely
				</li>
				<li><strong>Fly.io:</strong> Our hosting provider for the web and WebSocket servers</li>
			</ul>

			<h3 class="mb-2 text-xl font-medium">4.3 Legal Requirements</h3>
			<p class="mb-4">
				We may disclose your information if required by law, court order, or governmental request,
				or to protect the rights, property, or safety of Picologs or others.
			</p>

			<h3 class="mb-2 text-xl font-medium">4.4 We Do Not Sell Your Data</h3>
			<p class="mb-4">
				We do not sell, rent, or trade your personal information to third parties for marketing
				purposes.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">5. Data Storage and Security</h2>
			<h3 class="mb-2 text-xl font-medium">5.1 Where We Store Your Data</h3>
			<ul class="mb-4 ml-6 list-disc">
				<li><strong>Database:</strong> Neon PostgreSQL (serverless, encrypted at rest)</li>
				<li><strong>File Storage:</strong> Fly.io Tigris storage for uploaded avatars</li>
				<li>
					<strong>Desktop App:</strong> Local storage on your device (settings, logs, friend lists)
				</li>
			</ul>

			<h3 class="mb-2 text-xl font-medium">5.2 Security Measures</h3>
			<p class="mb-4">We implement security measures including:</p>
			<ul class="mb-4 ml-6 list-disc">
				<li>Encrypted connections (HTTPS/WSS)</li>
				<li>Secure authentication tokens (JWT)</li>
				<li>Database encryption at rest</li>
				<li>Regular security updates and monitoring</li>
			</ul>

			<h3 class="mb-2 text-xl font-medium">5.3 Data Retention</h3>
			<p class="mb-4">
				We retain your data for as long as your account is active or as needed to provide the
				Service. You may request deletion of your account and data at any time.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">6. Your Privacy Rights</h2>
			<p class="mb-4">You have the right to:</p>
			<ul class="mb-4 ml-6 list-disc">
				<li><strong>Access:</strong> Request a copy of your personal data</li>
				<li><strong>Correction:</strong> Update or correct your information</li>
				<li><strong>Deletion:</strong> Request deletion of your account and data</li>
				<li>
					<strong>Data Portability:</strong> Request your data in a machine-readable format
				</li>
				<li><strong>Withdraw Consent:</strong> Disconnect Discord authentication at any time</li>
				<li>
					<strong>Opt-Out:</strong> Stop sharing logs by disconnecting from the WebSocket server or closing
					the desktop app
				</li>
			</ul>
			<p class="mb-4">
				To exercise these rights, please contact us through our Discord community.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">7. Cookies and Tracking</h2>
			<p class="mb-4">We use cookies and similar technologies for:</p>
			<ul class="mb-4 ml-6 list-disc">
				<li>
					<strong>Authentication:</strong> Maintaining your logged-in session (discord_info, discord_token)
				</li>
				<li><strong>Preferences:</strong> Storing user settings and preferences</li>
			</ul>
			<p class="mb-4">
				We do not use third-party advertising or analytics cookies. You can control cookies through
				your browser settings.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">8. Children's Privacy</h2>
			<p class="mb-4">
				The Service is not intended for users under the age of 13. We do not knowingly collect
				personal information from children under 13. If you believe we have collected information
				from a child under 13, please contact us immediately.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">9. International Data Transfers</h2>
			<p class="mb-4">
				Your information may be transferred to and processed in countries other than your country of
				residence. These countries may have different data protection laws. By using the Service,
				you consent to such transfers.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">10. Third-Party Links</h2>
			<p class="mb-4">
				The Service may contain links to third-party websites (Discord, etc.). We are not
				responsible for the privacy practices of these sites. We encourage you to review their
				privacy policies.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">11. Changes to This Privacy Policy</h2>
			<p class="mb-4">
				We may update this Privacy Policy from time to time. We will notify you of any material
				changes by updating the "Last updated" date and, where appropriate, providing additional
				notice. Your continued use of the Service after changes constitutes acceptance of the
				updated policy.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">12. Contact Us</h2>
			<p class="mb-4">
				If you have questions or concerns about this Privacy Policy or our data practices, please
				contact us through:
			</p>
			<ul class="mb-4 ml-6 list-disc">
				<li>Our Discord community</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">13. GDPR Compliance (EU Users)</h2>
			<p class="mb-4">
				If you are located in the European Economic Area (EEA), you have additional rights under the
				General Data Protection Regulation (GDPR):
			</p>
			<ul class="mb-4 ml-6 list-disc">
				<li>Right to be informed about data processing</li>
				<li>Right to access your personal data</li>
				<li>Right to rectification of inaccurate data</li>
				<li>Right to erasure ("right to be forgotten")</li>
				<li>Right to restrict processing</li>
				<li>Right to data portability</li>
				<li>Right to object to processing</li>
				<li>Rights related to automated decision-making</li>
			</ul>
			<p class="mb-4">
				Our lawful basis for processing your data is consent (via Discord OAuth) and legitimate
				interest (providing the Service).
			</p>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-semibold">14. California Privacy Rights (CCPA)</h2>
			<p class="mb-4">
				If you are a California resident, you have additional rights under the California Consumer
				Privacy Act (CCPA):
			</p>
			<ul class="mb-4 ml-6 list-disc">
				<li>Right to know what personal information is collected</li>
				<li>Right to know if personal information is sold or disclosed</li>
				<li>Right to say no to the sale of personal information</li>
				<li>Right to access your personal information</li>
				<li>Right to request deletion of your personal information</li>
				<li>Right to equal service and price</li>
			</ul>
			<p class="mb-4">Note: We do not sell your personal information to third parties.</p>
		</section>
	</div>
</div>
