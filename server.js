const http = require('http');
const path = require('path');
const fs = require('fs');

const Controller = require('./Controller/controller');
const controller = new Controller();

const PORT = process.env.PORT;
const fileType = {
	'.ico': 'image/x-icon',
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.eot': 'appliaction/vnd.ms-fontobject',
	'.ttf': 'aplication/font-sfnt'
};

const session = {};
const parseCookies = (cookie = '') =>
	cookie
		.split(';')
		.map(v => v.split('='))
		.reduce((acc, [k, v]) => {
			acc[k.trim()] = decodeURIComponent(v);
			return acc;
		}, {});

const validUrls = ['/', '/todos', '/register', '/card', 'login', 'logout', 'signUp'];

const server = http.createServer((req, res) => {
	const cookies = parseCookies(req.headers.cookie);
	const userId = session[cookies.userNumber];
	controller.setUser(userId);

	const ext = path.parse(req.url).ext; // 확장자 정보
	const publicPath = path.join(__dirname, '/public'); // public 경로
    let filePath;
    if (req.method === 'GET') { // 정적파일 처리
        if (req.url === '/') 
            filePath = path.join(__dirname, 'public/login.html');
		else if (req.url === '/todos') 
            filePath = path.join(__dirname, 'public/todos.html');
		else if (req.url === '/register') 
            filePath = path.join(__dirname, 'public/register.html');
        
        if (req.url === '/' || req.url === '/todos' || req.url === '/register') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            fs.readFile(filePath, (err, data) => {
                if (err) throw err;
                res.end(data);
            });
        } else if ((Object.keys(fileType).includes(ext))) { // 기타 정적 파일 처리
            fs.readFile(`${publicPath}${req.url}`, (err, data) => {
                if (err) {
                    res.statusCode = 404;
                    res.end('Not found');
                } else {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', fileType[ext]);
                    res.end(data);
                }
            });
        }		
	} 

	if (req.url === '/card' && Object.keys(session).indexOf(cookies.userNumber) !== -1) {
		if (req.method === 'GET') { // card 불러오기
			function loadCards(userId) {
				return new Promise(resolve => {
					setImmediate(() => { resolve(controller.loadCards(userId)) })
				});
			};
			async function getCards(userId) {
				const cards = await loadCards(userId);
				res.end(JSON.stringify(cards));
			}
			getCards(userId);
		} else if (req.method === 'POST') { // card 추가
			let card;
			req.on('data', data => {
				card = JSON.parse(data);
			});
			return req.on('end', () => {
				controller.addCard(card); 
				res.end();
			}); 
		} else if (req.method === 'DELETE') { // card 삭제
			let card;
			req.on('data', data => {
				card = JSON.parse(data);
			});
			return req.on('end', () => {
				controller.deleteCard(card);
				res.end();
			});
		} else if (req.method === 'PATCH') { // card 이동
			let dragInfo;
			req.on('data', data => {
				dragInfo = JSON.parse(data);
			});
			return req.on('end', () => {
				controller.moveCard(dragInfo);
				res.end();
			});
		}
	}
	
	if (req.method === 'POST') {
		if (req.url === '/login') { 
			let userInput;
			req.on('data', data => userInput = data);
			return req.on('end', () => {
				const id = controller.login(userInput);
				if (id) {
					const randomNum = +new Date();
					session[randomNum] = id;
					res.writeHead(302, { Location: '/todos', 'Set-Cookie': `userNumber=${randomNum}; HttpOnly; Path=/` });
					res.end();
					console.log('로그인 성공');
				} else {
					res.writeHead(204);
					res.end();
					console.log('로그인 실패');
				}
			});
		} else if (req.url === '/logout') {
			delete session[cookies.userNumber];
			controller.logout(userId);
			res.writeHead(302, { 'Set-Cookie': '/', Location: '/' });
			return res.end();
		} else if (req.url === '/signUp') { 
			let newUser;
			req.on('data', data => {
				newUser = JSON.parse(data);
			});
			return req.on('end', () => {
				controller.signUp(newUser);
				const randomNum = +new Date();
				session[randomNum] = newUser.id;
				res.writeHead(302, { Location: '/todos', 'Set-Cookie': `userNumber=${randomNum}; HttpOnly; Path=/` });
				res.end();
				console.log('회원가입 성공');
			})
		}
	} 

	if (!(validUrls.includes(req.url) || Object.keys(fileType).includes(ext))) { // 잘못된 요청
		delete session[cookies.userNumber];
		controller.logout(userId);
		res.statusCode = 404;
		const filePath = path.join(__dirname, 'public/err.html');
		fs.readFile(filePath, (err, data) => {
			if (err) throw err;
			res.end(data);
		});
	}
});

server.listen(PORT, () => {
	console.log('서버 대기중');
});

