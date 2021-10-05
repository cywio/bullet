import log from '../../../../lib/server/log'
import prisma from '../../../../lib/server/db'
import github from '../../../../lib/server/github'
import getSession from '../../../../lib/server/session'
import axios from 'axios'

export default async function (req, res) {
	try {
		let { id } = req.query
		let { id: accountId, admin } = await getSession(req, res)

		let project = await prisma.projects.findUnique({
			where: { id },
			include: {
				domains: true,
				accounts: true,
			},
		})

		if (!project) return res.status(404).send()
		if (!admin && project.owner !== accountId) return res.status(403).send()

		if (req.method === 'POST') {
			let { repo_id, branch } = req.body

			if (!repo_id || !branch) return res.status(400).send()

			let { access_token } = await github(req, res, project.accounts.id)

			if (!access_token) return res.status(409).send()

			let { data: repositories } = await axios.get(`https://api.github.com/user/repos`, {
				headers: {
					Authorization: `token ${access_token}`,
				},
			})

			let repo = repositories.find((a) => a.id == repo_id)
			if (!repo) return res.status(404).send()

			let updated = await prisma.projects.update({
				where: {
					id: project.id,
				},
				data: {
					origin: `github:${repo.id}:${branch}`,
				},
			})

			await log(req, accountId, `New Github repo was linked to project ${project.name}}`)

			res.send(updated)
		} else {
			res.status(405).send()
		}
	} catch (e) {
		if (typeof e == 'undefined') return e
		res.status(500).send()
	}
}
