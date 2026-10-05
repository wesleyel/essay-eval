-- 示例作答。重复执行不会覆盖已有数据。
INSERT OR IGNORE INTO essays (id, subject, type, title, category, tags, prompt, content, word_count, created_at, updated_at) VALUES ('demo-part-a', 'english', 'part-a', '2026 Part A 传统家书回复信 (示例草稿)', 'email-reply', '["2026真题","家书展览","回复信"]', 'Directions: Read the following email from your friend Paul and write him a reply.
Hi Li Ming,
I was really moved by the Chinese families'' handwritten letters you posted yesterday. They are priceless! Could you please tell me a bit more about them? And are they currently on public display somewhere? I''m very keen to see them in person. Thanks.
You should write about 100 words. Use "Li Ming" instead.', 'Hi Paul,

I am delight to hear that you were touched by the handwritten family letters I shared yesterday!

These letters, spanning several generation from the 1950s to the 1990s, records ordinary Chinese families'' daily joys, traditional virtue, and deep emotional bonds. Each letter is filled with warmth and wisdom. Fortunately, they are currently showcased in a special exhibition at the Provincial Museum, which runs untill the end of next month. Admission is free with online reservasion.

I would love to accompany with you there this Saturday morning if you are free. Let me know if that works for you!

Best,
Li Ming', 103, strftime('%Y-%m-%dT%H:%M:%fZ'), strftime('%Y-%m-%dT%H:%M:%fZ'));

INSERT OR IGNORE INTO essays (id, subject, type, title, category, tags, prompt, content, word_count, created_at, updated_at) VALUES ('demo-part-b', 'english', 'part-b', '2026 Part B 新兴技术态度与考量 (双图表草稿)', 'chart-double', '["2026新题型","双图表","科技双刃剑"]', 'Directions: Write an essay based on the charts below. In your essay you should describe the drawing briefly, interpret the charts, and give your comments. (160–200 words, 20 points)', 'The given charts illustrate the public''s attitudes toward an emerging technology and the primary factors influencing their choices. As shown in the pie chart, a substantial majority holds a receptive attitude, with 39.3% of respondents fully accept it and 32.8% partially accepting it, while only 27.9% expresses refusal. Meanwhile, the bar chart reveals that safety ranks as the foremost consideration, accounting for 46.3%, followed by price at 24.9%.

This survey highlights the dual public sentiment toward technological innovations: general openness coupled with rational caution. On the one hand, innovative services attract widespread acceptance because they enhance efficiency and transform daily routines. On the other hand, users remain prudent regarding potential risks, prioritizing safety and reliability above economic cost.

In my view, while emerging technologies represent the inevitable trend of modern progress, developers and government must prioritize user security. Only when safety is comprehensively guaranteed can new technological products win public trust and achieve sustainable growth.', 160, strftime('%Y-%m-%dT%H:%M:%fZ'), strftime('%Y-%m-%dT%H:%M:%fZ'));

INSERT OR IGNORE INTO essays (id, subject, type, title, category, tags, prompt, content, word_count, created_at, updated_at) VALUES ('demo-pol-mayuan', 'politics', 'mayuan', '2026真题演练：唯物辩证法矛盾观与生态文明建设 (第34题·马原)', 'mayuan-dialectic', '["34题马原","对立统一","两点论重点论","绿水青山"]', '【材料分析题】（10分）
材料：某地在推进经济转型过程中，曾一度面临“要绿水青山还是要金山银山”的两难抉择。后来，当地转变思路，坚持生态优先、绿色发展，把生态环境优势转化为生态农业、文旅等绿色产业优势，走出了一条“绿水青山就是金山银山”的高质量发展新路。生态好了，百姓腰包也鼓了，实现了生态保护与经济发展的良性互动。
结合材料回答问题：
(1) 运用唯物辩证法矛盾的同一性和斗争性辩证关系原理，分析经济发展与环境保护之间的关系。（5分）
(2) 说明在实践中如何运用矛盾分析法正确处理两者的关系，实现高质量发展。（5分）', '(1) 唯物辩证法认为，矛盾是事物发展的源泉和动力。矛盾的同一性和斗争性是矛盾的两种基本属性。
① 矛盾的斗争性指矛盾双方相互排斥、相互对立。在传统粗放发展模式下，片面追求经济增长容易破坏生态环境，两者存在对立；
② 矛盾的同一性指矛盾双方相互依存、在一定条件下相互转化。良好的生态环境是经济社会可持续发展的基础，保护生态环境就是保护生产力；
③ 矛盾的同一性是斗争性的前提，斗争性寓于同一性之中。经济发展与环境保护是对立统一的关系，不能把两者割裂开来。

(2) 在实践中，应坚持矛盾分析法，把握对立统一：
① 坚持“两点论”与“重点论”的统一。既要抓经济发展这个中心，又要守住生态保护红线，做到生态优先、绿色发展；
② 促进矛盾双方在一定条件下向有利方向转化。材料中当地把生态优势转化为产业优势，实现了“绿水青山”向“金山银山”的转化；
③ 牢固树立绿水青山就是金山银山的理念，协同推进降碳、减污、扩绿、增长，走生产发展、生活富裕、生态良好的文明发展道路。', 361, strftime('%Y-%m-%dT%H:%M:%fZ'), strftime('%Y-%m-%dT%H:%M:%fZ'));

INSERT OR IGNORE INTO essays (id, subject, type, title, category, tags, prompt, content, word_count, created_at, updated_at) VALUES ('demo-pol-maozhongte', 'politics', 'maozhongte', '2026热点演练：加快发展新质生产力与推进中国式现代化 (第35题·毛中特)', 'maozhongte-productivity', '["35题毛中特","新质生产力","高质量发展","科技创新"]', '【材料分析题】（10分）
材料：新质生产力是创新起主导作用，具有高科技、高效能、高质量特征，符合新发展理念的先进生产力质态。高质量发展是全面建设社会主义现代化国家的首要任务，加快发展新质生产力是推动高质量发展的内在要求和重要着力点。
结合材料回答问题：
(1) 结合材料说明为什么发展新质生产力是推动高质量发展的内在要求？（5分）
(2) 我国应如何通过深化改革与科技创新，加快培育和发展新质生产力？（5分）', '(1) 生产力是人类社会发展的根本动力。新质生产力是推动高质量发展的内在要求：
① 高质量发展需要先进生产力质态的支撑。传统粗放增长模式难以为继，新质生产力以创新为主导，能够摆脱传统增长路径；
② 新质生产力契合新发展理念。它具有高科技、高效能、高质量特征，能够推动产业深度转型升级，提升全要素生产率；
③ 发展新质生产力是赢得国际竞争主动权的战略选择，也是推进中国式现代化的物质技术基础。

(2) 加快培育和发展新质生产力，应从以下方面着力：
① 坚持创新驱动发展战略。加强原创性、颠覆性科技创新，加快实现高水平科技自立自强，打好关键核心技术攻坚战；
② 推动产业创新与转型升级。以科技创新引领现代化产业体系建设，改造提升传统产业，培育壮大新兴产业，布局未来产业；
③ 深化体制机制改革。着力打通束缚新质生产力发展的堵点卡点，优化创新资源配置，畅通教育、科技、人才良性循环。', 331, strftime('%Y-%m-%dT%H:%M:%fZ'), strftime('%Y-%m-%dT%H:%M:%fZ'));
